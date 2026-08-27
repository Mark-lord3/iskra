import { commitShuffle } from './cards.js';
import { evaluate, compareScores } from './evaluator.js';
import { awardPots, buildPots } from './pots.js';

export const STREETS = ['preflop','flop','turn','river','showdown','complete'];

/**
 * One hand of no-limit Texas hold'em.
 *
 * The whole hand is a plain serialisable object mutated only through
 * applyAction, so it can live in the database, be replayed from a log, and be
 * reasoned about in tests without a table, a socket, or a clock. Nothing here
 * reads the client: the caller supplies a seat and an intent and the engine
 * decides whether it is legal.
 */
export function createHand({
  seats, buttonSeat, smallBlind, bigBlind, ante = 0, deck = null, handId = null
}){
  const live = seats.filter(s => s.stack > 0);
  if(live.length < 2) throw new Error('a hand needs at least two funded seats');

  const shuffled = deck ? { deck, seed:null, commitment:null } : commitShuffle();
  const order = live.map(s => s.seat).sort((a,b) => a - b);
  const heads = live.length === 2;

  const hand = {
    handId, version: 0, street: 'preflop', board: [],
    buttonSeat, smallBlind, bigBlind, ante, headsUp: heads,
    deck: shuffled.deck, deckIndex: 0,
    shuffleCommitment: shuffled.commitment, shuffleSeed: shuffled.seed,
    seats: {}, order,
    currentBet: 0, minRaise: bigBlind, lastAggressor: null,
    actor: null, actionLog: [], pots: [], payouts: null, result: null
  };

  for(const s of live){
    hand.seats[s.seat] = {
      seat: s.seat, playerId: s.playerId, stack: s.stack,
      committed: 0,        // this street
      total: 0,            // this hand
      folded: false, allIn: false, acted: false,
      hole: [], sittingOut: !!s.sittingOut
    };
  }

  // Antes first, then blinds. Heads-up the button posts the small blind.
  if(ante > 0) for(const seat of order) post(hand, seat, Math.min(ante, hand.seats[seat].stack), 'ante');

  const sbSeat = heads ? buttonSeat : nextOccupied(hand, buttonSeat);
  const bbSeat = heads ? nextOccupied(hand, buttonSeat) : nextOccupied(hand, sbSeat);
  post(hand, sbSeat, Math.min(smallBlind, hand.seats[sbSeat].stack), 'small blind');
  post(hand, bbSeat, Math.min(bigBlind, hand.seats[bbSeat].stack), 'big blind');
  hand.currentBet = Math.max(...order.map(s => hand.seats[s].committed));
  hand.minRaise = bigBlind;
  hand.blinds = { sbSeat, bbSeat };

  // Two hole cards each, dealt one at a time from the left of the button.
  for(let round = 0; round < 2; round++)
    for(const seat of seatsFrom(hand, nextOccupied(hand, buttonSeat)))
      hand.seats[seat].hole.push(hand.deck[hand.deckIndex++]);

  // Pre-flop action starts left of the big blind; heads-up that is the button.
  hand.actor = heads ? buttonSeat : nextToAct(hand, bbSeat);
  if(everyoneAllIn(hand)) closeStreet(hand);
  return hand;
}

/* ------------------------------------------------------------------ helpers */

const occupied = hand => hand.order.filter(s => !hand.seats[s].folded);

function nextOccupied(hand, from){
  const i = hand.order.indexOf(from);
  for(let step = 1; step <= hand.order.length; step++){
    const seat = hand.order[(i + step) % hand.order.length];
    if(!hand.seats[seat].folded) return seat;
  }
  return from;
}

function seatsFrom(hand, start){
  const i = hand.order.indexOf(start);
  return hand.order.slice(i).concat(hand.order.slice(0, i));
}

/** Next seat that can still make a decision (not folded, not already all in). */
function nextToAct(hand, from){
  const i = hand.order.indexOf(from);
  for(let step = 1; step <= hand.order.length; step++){
    const seat = hand.order[(i + step) % hand.order.length];
    const s = hand.seats[seat];
    if(!s.folded && !s.allIn) return seat;
  }
  return null;
}

function post(hand, seat, amount, label){
  const s = hand.seats[seat];
  const paid = Math.min(amount, s.stack);
  s.stack -= paid; s.committed += paid; s.total += paid;
  if(s.stack === 0) s.allIn = true;
  hand.actionLog.push({ seat, type: label, amount: paid, street: hand.street });
}

const everyoneAllIn = hand =>
  occupied(hand).filter(s => !hand.seats[s].allIn).length <= 1;

/* ------------------------------------------------------------ legal actions */

/**
 * What the seat to act may legally do right now. The client renders from this,
 * but the server recomputes it on every action, so a tampered client gains
 * nothing.
 */
export function legalActions(hand, seat){
  if(hand.street === 'complete' || hand.street === 'showdown') return [];
  if(hand.actor !== seat) return [];
  const s = hand.seats[seat];
  if(!s || s.folded || s.allIn) return [];

  const toCall = hand.currentBet - s.committed;
  const actions = [];

  if(toCall > 0) actions.push({ type:'fold' });
  else actions.push({ type:'check' });

  if(toCall > 0)
    actions.push({ type:'call', amount: Math.min(toCall, s.stack) });

  // A bet opens a street; a raise answers an existing bet.
  const opening = hand.currentBet === 0;
  const minTarget = opening ? hand.bigBlind : hand.currentBet + hand.minRaise;
  const maxTarget = s.committed + s.stack;                 // going all in
  if(maxTarget > hand.currentBet){
    actions.push({
      type: opening ? 'bet' : 'raise',
      min: Math.min(minTarget, maxTarget),                 // a short all-in is still allowed
      max: maxTarget
    });
  }
  if(s.stack > 0) actions.push({ type:'allin', amount: maxTarget });
  return actions;
}

/**
 * Apply one action.
 *
 * @param {object} hand
 * @param {{seat:number,type:string,amount?:number,version?:number,actionId?:string}} move
 * `version` guards against a stale client; `actionId` makes a retried click a
 * no-op instead of a second bet.
 */
export function applyAction(hand, move){
  const { seat, type, actionId } = move;

  if(actionId && hand.actionLog.some(a => a.actionId === actionId))
    return { ok:true, duplicate:true, hand };            // idempotent retry

  if(move.version != null && move.version !== hand.version)
    return { ok:false, code:'STALE_VERSION', error:'The hand moved on. Refresh and try again.' };
  if(hand.street === 'complete' || hand.street === 'showdown')
    return { ok:false, code:'HAND_OVER', error:'This hand has finished.' };
  if(hand.actor !== seat)
    return { ok:false, code:'NOT_YOUR_TURN', error:'It is not your turn.' };

  const s = hand.seats[seat];
  const toCall = hand.currentBet - s.committed;
  const legal = legalActions(hand, seat);
  const allowed = new Set(legal.map(a => a.type));
  if(!allowed.has(type))
    return { ok:false, code:'ILLEGAL_ACTION', error:`You cannot ${type} here.` };

  switch(type){
    case 'fold':
      s.folded = true;
      hand.actionLog.push({ seat, type:'fold', amount:0, street:hand.street, actionId });
      break;

    case 'check':
      if(toCall > 0) return { ok:false, code:'ILLEGAL_ACTION', error:'There is a bet to call.' };
      s.acted = true;
      hand.actionLog.push({ seat, type:'check', amount:0, street:hand.street, actionId });
      break;

    case 'call': {
      const paid = Math.min(toCall, s.stack);
      s.stack -= paid; s.committed += paid; s.total += paid; s.acted = true;
      if(s.stack === 0) s.allIn = true;
      hand.actionLog.push({ seat, type:'call', amount:paid, street:hand.street, actionId });
      break;
    }

    case 'bet':
    case 'raise':
    case 'allin': {
      const spec = legal.find(a => a.type === type) || legal.find(a => a.type === 'raise' || a.type === 'bet');
      const target = type === 'allin' ? s.committed + s.stack : Number(move.amount);
      if(!Number.isInteger(target))
        return { ok:false, code:'BAD_AMOUNT', error:'That amount is not valid.' };
      if(target > s.committed + s.stack)
        return { ok:false, code:'BAD_AMOUNT', error:'That is more than your stack.' };
      if(type !== 'allin' && target < spec.min)
        return { ok:false, code:'BELOW_MIN', error:`The minimum is ${spec.min}.` };
      if(target <= hand.currentBet && target < s.committed + s.stack)
        return { ok:false, code:'BAD_AMOUNT', error:'A raise must exceed the current bet.' };

      const paid = target - s.committed;
      s.stack -= paid; s.committed = target; s.total += paid;
      if(s.stack === 0) s.allIn = true;

      const raiseBy = target - hand.currentBet;
      // A short all-in that does not reach a full raise never reopens betting.
      if(raiseBy >= hand.minRaise){
        hand.minRaise = raiseBy;
        hand.lastAggressor = seat;
        for(const other of hand.order)
          if(other !== seat && !hand.seats[other].folded && !hand.seats[other].allIn)
            hand.seats[other].acted = false;
      }
      hand.currentBet = Math.max(hand.currentBet, target);
      s.acted = true;
      hand.actionLog.push({ seat, type, amount:paid, to:target, street:hand.street, actionId });
      break;
    }
    default:
      return { ok:false, code:'ILLEGAL_ACTION', error:'Unknown action.' };
  }

  hand.version += 1;
  advance(hand);
  return { ok:true, hand };
}

/* --------------------------------------------------------------- progression */

function streetClosed(hand){
  const live = occupied(hand);
  if(live.length <= 1) return true;
  const deciders = live.filter(s => !hand.seats[s].allIn);
  if(deciders.length === 0) return true;
  // Everyone still deciding must have acted and matched the current bet.
  return deciders.every(s => hand.seats[s].acted && hand.seats[s].committed === hand.currentBet);
}

function advance(hand){
  if(occupied(hand).length === 1){ finish(hand); return; }
  if(!streetClosed(hand)){
    const next = nextToAct(hand, hand.actor);
    hand.actor = next;
    if(next === null) closeStreet(hand);
    return;
  }
  closeStreet(hand);
}

function closeStreet(hand){
  for(const seat of hand.order){ hand.seats[seat].committed = 0; hand.seats[seat].acted = false; }
  hand.currentBet = 0; hand.minRaise = hand.bigBlind; hand.lastAggressor = null;

  const deal = n => { hand.deckIndex++;                       // burn
    for(let i=0;i<n;i++) hand.board.push(hand.deck[hand.deckIndex++]); };

  if(hand.street === 'preflop'){ hand.street = 'flop';  deal(3); }
  else if(hand.street === 'flop'){  hand.street = 'turn';  deal(1); }
  else if(hand.street === 'turn'){  hand.street = 'river'; deal(1); }
  else { finish(hand); return; }

  // When nobody can act any more, run the remaining board out and pay.
  if(everyoneAllIn(hand)){ closeStreet(hand); return; }
  hand.actor = nextToAct(hand, hand.buttonSeat);
  if(hand.actor === null) closeStreet(hand);
}

function finish(hand){
  hand.street = 'showdown';
  const players = hand.order.map(s => ({
    seat: s, committed: hand.seats[s].total, folded: hand.seats[s].folded
  }));
  hand.pots = buildPots(players);

  const live = occupied(hand);
  const orderFromButton = seatsFrom(hand, nextOccupied(hand, hand.buttonSeat));

  const rankSeats = seats => {
    if(seats.length === 1) return [[seats[0]]];
    const scored = seats.map(seat => ({
      seat, score: evaluate([...hand.seats[seat].hole, ...hand.board]).score
    }));
    scored.sort((a,b) => compareScores(b.score, a.score));
    const groups = [];
    for(const s of scored){
      const top = groups[groups.length - 1];
      if(top && compareScores(hand._scoreOf(top[0]), s.score) === 0) top.push(s.seat);
      else groups.push([s.seat]);
    }
    return groups;
  };
  // Small helper kept off the serialised object.
  Object.defineProperty(hand, '_scoreOf', { value: seat =>
    evaluate([...hand.seats[seat].hole, ...hand.board]).score, enumerable:false, configurable:true });

  const uncontested = live.length === 1;
  const { payouts, detail } = awardPots(
    hand.pots,
    uncontested ? () => [live] : rankSeats,
    orderFromButton
  );

  for(const [seat, chips] of payouts) hand.seats[seat].stack += chips;

  hand.payouts = Object.fromEntries(payouts);
  hand.result = {
    uncontested,
    board: hand.board.slice(),
    pots: detail,
    showdown: uncontested ? [] : live.map(seat => ({
      seat,
      hole: hand.seats[seat].hole.slice(),
      hand: evaluate([...hand.seats[seat].hole, ...hand.board]).name
    }))
  };
  hand.actor = null;
  hand.street = 'complete';
  hand.version += 1;
}

/**
 * The view one seat is allowed to receive. Hole cards belong only to their
 * owner until a contested showdown reveals them.
 */
export function viewFor(hand, seat){
  const showdown = hand.street === 'complete' && !hand.result?.uncontested;
  return {
    handId: hand.handId, version: hand.version, street: hand.street,
    board: hand.board.slice(), pot: hand.pots.reduce((s,p)=>s+p.amount,0) ||
      hand.order.reduce((s,x)=>s+hand.seats[x].total,0),
    currentBet: hand.currentBet, minRaise: hand.minRaise,
    buttonSeat: hand.buttonSeat, actor: hand.actor,
    // Blind positions and pot sizes are public table information; the client
    // needs them to place the markers and label side pots.
    blinds: hand.blinds || null,
    pots: (hand.pots || []).map(p => ({ amount: p.amount })),
    shuffleCommitment: hand.shuffleCommitment,
    seats: hand.order.map(s => {
      const p = hand.seats[s];
      const mine = s === seat;
      return {
        seat: s, playerId: p.playerId, stack: p.stack, committed: p.committed,
        folded: p.folded, allIn: p.allIn,
        hole: mine || (showdown && !p.folded) ? p.hole.slice() : (p.hole.length ? ['?','?'] : [])
      };
    }),
    legal: legalActions(hand, seat),
    result: hand.street === 'complete' ? hand.result : null
  };
}
