import { randomUUID, randomInt } from 'node:crypto';
import { createHand, applyAction, legalActions, viewFor } from './hand.js';

/**
 * Demo poker. The same engine as the tournament, played against simple
 * opponents, held only in memory.
 *
 * Nothing here is persisted, nothing counts towards a tournament, and no prize
 * can come out of it. It exists so someone can see how the table works before
 * deciding whether to make an account.
 */
const SESSIONS = new Map();
const MAX_HANDS = 3;
const TTL_MS = 45 * 60_000;
const START_STACK = 5000;
const BOTS = ['NEON', 'VOSTOK'];

setInterval(() => {
  const cutoff = Date.now() - TTL_MS;
  for(const [id, s] of SESSIONS) if(s.touchedAt < cutoff) SESSIONS.delete(id);
}, 5 * 60_000).unref?.();

export function createDemo({ displayName = 'YOU', maxHands = MAX_HANDS } = {}){
  const id = randomUUID();
  const session = {
    id, displayName,
    handsPlayed: 0, maxHands: Math.min(Math.max(1, maxHands), 10),
    stacks: [START_STACK, START_STACK, START_STACK],
    buttonSeat: 0, hand: null, log: [], touchedAt: Date.now(), finished: false
  };
  SESSIONS.set(id, session);
  deal(session);
  return publicDemo(session);
}

export function getDemo(id){
  const session = SESSIONS.get(String(id));
  if(!session) return null;
  session.touchedAt = Date.now();
  return publicDemo(session);
}

export function actDemo(id, move){
  const session = SESSIONS.get(String(id));
  if(!session) return { ok:false, code:'DEMO_EXPIRED' };
  session.touchedAt = Date.now();
  if(!session.hand || session.hand.street === 'complete') return { ok:false, code:'NO_HAND' };
  if(session.hand.actor !== 0) return { ok:false, code:'NOT_YOUR_TURN' };

  const outcome = applyAction(session.hand, {
    seat: 0, type: move.type, amount: move.amount, actionId: move.actionId || randomUUID()
  });
  if(!outcome.ok) return outcome;

  runBots(session);
  settle(session);
  return { ok:true, demo: publicDemo(session) };
}

export function nextDemoHand(id){
  const session = SESSIONS.get(String(id));
  if(!session) return { ok:false, code:'DEMO_EXPIRED' };
  session.touchedAt = Date.now();
  if(session.finished) return { ok:false, code:'DEMO_FINISHED', demo: publicDemo(session) };
  if(session.hand && session.hand.street !== 'complete') return { ok:false, code:'HAND_IN_PROGRESS' };
  deal(session);
  return { ok:true, demo: publicDemo(session) };
}

export function endDemo(id){ SESSIONS.delete(String(id)); }

/* ------------------------------------------------------------------ internals */

function deal(session){
  if(session.handsPlayed >= session.maxHands){ session.finished = true; return; }
  const seats = session.stacks
    .map((stack, seat) => ({ seat, playerId: seat === 0 ? 'you' : `bot${seat}`, stack }))
    .filter(s => s.stack > 0);
  if(seats.length < 2 || !seats.some(s => s.seat === 0)){ session.finished = true; return; }

  session.buttonSeat = seats.map(s => s.seat).find(s => s > session.buttonSeat) ?? seats[0].seat;
  session.hand = createHand({
    seats, buttonSeat: session.buttonSeat,
    smallBlind: 25, bigBlind: 50, handId: randomUUID()
  });
  session.handsPlayed += 1;
  session.log = [];
  runBots(session);
  settle(session);
}

/** Opponents act until it is the player's turn again, or the hand ends. */
function runBots(session){
  const hand = session.hand;
  for(let guard = 0; guard < 40; guard++){
    if(!hand || hand.street === 'complete' || hand.actor === null || hand.actor === 0) return;
    const seat = hand.actor;
    const legal = legalActions(hand, seat);
    if(!legal.length) return;
    const choice = botChoice(hand, seat, legal);
    const before = hand.version;
    applyAction(hand, { seat, ...choice, actionId: randomUUID() });
    if(hand.version === before) return;   // refused: stop rather than spin
    session.log.push({ seat, name: BOTS[seat - 1], type: choice.type, amount: choice.amount || 0 });
  }
}

/**
 * A deliberately plain opponent: it calls small bets, checks when free, and
 * occasionally raises. It is here to make the demo playable, not to be strong.
 */
function botChoice(hand, seat, legal){
  const types = new Set(legal.map(a => a.type));
  const me = hand.seats[seat];
  const toCall = hand.currentBet - me.committed;
  const roll = randomInt(100);

  if(toCall === 0){
    if(types.has('bet') && roll < 25){
      const bet = legal.find(a => a.type === 'bet');
      return { type:'bet', amount: Math.min(bet.max, Math.max(bet.min, hand.bigBlind * 2)) };
    }
    return { type:'check' };
  }
  const price = toCall / Math.max(1, me.stack + me.total);
  if(price > 0.55 && roll < 70) return { type:'fold' };
  if(types.has('raise') && roll < 12){
    const raise = legal.find(a => a.type === 'raise');
    return { type:'raise', amount: Math.min(raise.max, raise.min) };
  }
  if(types.has('call')) return { type:'call' };
  return types.has('check') ? { type:'check' } : { type:'fold' };
}

function settle(session){
  const hand = session.hand;
  if(!hand || hand.street !== 'complete') return;
  session.stacks = session.stacks.map((stack, seat) => hand.seats[seat] ? hand.seats[seat].stack : stack);
  if(session.handsPlayed >= session.maxHands || session.stacks[0] <= 0) session.finished = true;
}

function publicDemo(session){
  return {
    demoId: session.id,
    handsPlayed: session.handsPlayed,
    maxHands: session.maxHands,
    finished: session.finished,
    // Said plainly on every payload, not only in the interface.
    disclaimer: 'Demo play. Chips have no value and no prize can be won here.',
    seats: session.stacks.map((stack, seat) => ({
      seatIndex: seat, displayName: seat === 0 ? session.displayName : BOTS[seat - 1],
      stack, isMe: seat === 0, isBot: seat !== 0
    })),
    log: session.log.slice(-6),
    hand: session.hand ? viewFor(session.hand, 0) : null
  };
}
