/**
 * Turning authoritative server state into animation events.
 *
 * The table never invents motion from a client-side timer. Every animation is
 * derived here by comparing the previous server snapshot with the next one, so
 * what a player sees is always something the server actually said happened.
 *
 * The functions in this file are pure: no React, no DOM, no clock. That is
 * what makes the ordering testable.
 */

/** Events are emitted in this order within a single diff. */
export const EVENT_ORDER = ['stage','deal','blinds','action','bet','fold','collect','flip',
                            'showdown','award','celebrate','eliminate','presence','level'];

const seatsOf = state => state?.hand?.seats || [];
const seatIn = (state, index) => seatsOf(state).find(s => s.seat === index);
const boardOf = state => state?.hand?.board || [];
const tableSeat = (state, index) => (state?.seats || []).find(s => s.seatIndex === index);
const nameOf = (state, index) => tableSeat(state, index)?.displayName || `Seat ${index + 1}`;

/**
 * Compare two snapshots and produce the ordered animation events between them.
 * `prev` may be null, which happens on first load and after a reconnect.
 */
export function diffTable(prev, next){
  if(!next) return [];
  const events = [];
  const newHand = !prev || prev.hand?.handId !== next.hand?.handId;

  /* A fresh hand: clear the felt, move the markers, deal. */
  if(newHand && next.hand){
    events.push({ type:'stage', key:'newHand', label:'hand', handNumber: next.handNumber });
    const dealt = seatsOf(next).filter(s => (s.hole || []).length > 0).length;
    if(dealt) events.push({ type:'deal', count: dealt * 2, seats: seatsOf(next).map(s => s.seat) });
    events.push({ type:'blinds', button: next.hand.buttonSeat });
  } else if(prev?.hand && next.hand && prev.hand.buttonSeat !== next.hand.buttonSeat){
    events.push({ type:'blinds', button: next.hand.buttonSeat });
  }

  /* What each player did. Derived from committed chips and fold state so a
     dropped message can never desynchronise the table from the server. */
  if(prev?.hand && next.hand && !newHand){
    for(const after of seatsOf(next)){
      const before = seatIn(prev, after.seat);
      if(!before) continue;

      if(!before.folded && after.folded){
        events.push({ type:'action', move:'fold', seat: after.seat, name: nameOf(next, after.seat) });
        events.push({ type:'fold', seat: after.seat });
        continue;
      }

      const staked = (after.committed || 0) - (before.committed || 0);
      if(staked > 0){
        const move = after.allIn && !before.allIn ? 'allIn'
          : (before.committed || 0) === 0 && (prev.hand.currentBet || 0) === 0 ? 'bet'
          : after.committed > (prev.hand.currentBet || 0) ? 'raise' : 'call';
        events.push({ type:'action', move, seat: after.seat, amount: staked,
                      to: after.committed, name: nameOf(next, after.seat) });
        events.push({ type:'bet', seat: after.seat, amount: staked });
      } else if(prev.hand.actor === after.seat && next.hand.actor !== after.seat
                && !after.folded && staked === 0 && prev.hand.street === next.hand.street){
        events.push({ type:'action', move:'check', seat: after.seat, name: nameOf(next, after.seat) });
      }
    }
  }

  /* A street closed: chips gather into the pot, then the new cards turn over. */
  if(prev?.hand && next.hand && !newHand && prev.hand.street !== next.hand.street){
    const staked = seatsOf(prev).some(s => (s.committed || 0) > 0);
    if(staked) events.push({ type:'collect', pot: next.hand.pot, street: prev.hand.street });

    const before = boardOf(prev).length, after = boardOf(next).length;
    if(after > before)
      events.push({ type:'flip', cards: boardOf(next).slice(before), from: before,
                    street: next.hand.street });
  }

  /* Showdown, then the pot going where the server said it goes. */
  const result = next.hand?.result;
  const hadResult = prev?.hand?.result;
  if(result && !hadResult){
    if(!result.uncontested && result.showdown?.length)
      events.push({ type:'showdown', reveals: result.showdown });

    const pots = result.pots || [];
    const winners = awardsFrom(result, next);
    events.push({ type:'award', winners, pots, split: winners.length > 1,
                  uncontested: Boolean(result.uncontested) });
    if(winners.some(w => w.amount >= (next.hand.pot || 0) * 0.6) && (next.hand.pot || 0) > 0)
      events.push({ type:'celebrate', seats: winners.map(w => w.seat) });
  }

  /* Players leaving the table. */
  for(const after of next.seats || []){
    const before = tableSeat(prev, after.seatIndex);
    if(before && before.status !== 'eliminated' && after.status === 'eliminated')
      events.push({ type:'eliminate', seat: after.seatIndex, name: after.displayName });
    if(before && before.connected && !after.connected)
      events.push({ type:'presence', seat: after.seatIndex, name: after.displayName, connected:false });
    if(before && !before.connected && after.connected)
      events.push({ type:'presence', seat: after.seatIndex, name: after.displayName, connected:true });
  }

  /* Blinds going up is a moment, not a silent number change. */
  if(prev?.level && next.level && prev.level.level !== next.level.level)
    events.push({ type:'level', level: next.level.level,
                  smallBlind: next.level.smallBlind, bigBlind: next.level.bigBlind,
                  ante: next.level.ante, isBreak: next.level.isBreak });

  return sortEvents(events);
}

/** Who won what, read from the server's own payout figures. */
function awardsFrom(result, next){
  const totals = new Map();
  for(const pot of result.pots || [])
    for(const [seat, amount] of Object.entries(pot.payouts || {}))
      totals.set(Number(seat), (totals.get(Number(seat)) || 0) + Number(amount));

  if(!totals.size && next.hand?.result?.showdown?.length === 0){
    // An uncontested pot with no per-pot detail: the one live seat took it.
    const live = seatsOf(next).filter(s => !s.folded);
    if(live.length === 1) totals.set(live[0].seat, next.hand.pot || 0);
  }
  return [...totals.entries()]
    .map(([seat, amount]) => ({ seat, amount, name: nameOf(next, seat) }))
    .sort((a, b) => a.seat - b.seat);
}

export function sortEvents(events){
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => {
      const rank = EVENT_ORDER.indexOf(a.event.type) - EVENT_ORDER.indexOf(b.event.type);
      return rank !== 0 ? rank : a.index - b.index;
    })
    .map(pair => pair.event);
}

/**
 * Events that only describe a change already visible in the final state can be
 * dropped when catching up. Keeping the terminal ones means a player who
 * reconnects mid-hand still sees who won rather than a silent jump.
 */
const TERMINAL = new Set(['award','showdown','eliminate','level','stage','celebrate']);
export const isTerminal = event => TERMINAL.has(event.type);

/** Collapse a backlog to what still matters, preserving order. */
export function fastForward(events){
  const kept = events.filter(isTerminal);
  return kept.length ? kept : events.slice(-1);
}
