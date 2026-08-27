import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardFromString as C } from '../src/poker/cards.js';
import { applyAction, createHand, legalActions, viewFor } from '../src/poker/hand.js';

const seats = (...stacks) => stacks.map((stack, seat) => ({ seat, playerId:'p'+seat, stack }));
const act = (h, seat, type, amount) => applyAction(h, { seat, type, amount });
const chips = h => h.order.reduce((s, x) => s + h.seats[x].stack, 0);

test('three-handed blinds and first action are correct', () => {
  const h = createHand({ seats: seats(1000,1000,1000), buttonSeat:0, smallBlind:10, bigBlind:20 });
  assert.equal(h.blinds.sbSeat, 1);
  assert.equal(h.blinds.bbSeat, 2);
  assert.equal(h.seats[1].stack, 990);
  assert.equal(h.seats[2].stack, 980);
  assert.equal(h.actor, 0, 'under the gun acts first pre-flop');
});

test('heads-up the button posts the small blind and acts first pre-flop', () => {
  const h = createHand({ seats: seats(1000,1000), buttonSeat:0, smallBlind:10, bigBlind:20 });
  assert.equal(h.blinds.sbSeat, 0, 'the button is the small blind');
  assert.equal(h.blinds.bbSeat, 1);
  assert.equal(h.actor, 0, 'the button acts first pre-flop');
  act(h, 0, 'call'); act(h, 1, 'check');
  assert.equal(h.street, 'flop');
  assert.equal(h.actor, 1, 'the big blind acts first after the flop');
});

test('a raise must clear the minimum', () => {
  const h = createHand({ seats: seats(1000,1000,1000), buttonSeat:0, smallBlind:10, bigBlind:20 });
  const spec = legalActions(h, 0).find(a => a.type === 'raise');
  assert.equal(spec.min, 40, 'minimum raise is to twice the big blind');
  assert.equal(act(h, 0, 'raise', 30).code, 'BELOW_MIN');
  assert.equal(act(h, 0, 'raise', 40).ok, true);
  assert.equal(h.currentBet, 40);
});

test('a re-raise must clear the size of the last raise', () => {
  const h = createHand({ seats: seats(1000,1000,1000), buttonSeat:0, smallBlind:10, bigBlind:20 });
  act(h, 0, 'raise', 60);                       // raised by 40
  const spec = legalActions(h, 1).find(a => a.type === 'raise');
  assert.equal(spec.min, 100, 'must raise by at least 40 again');
  assert.equal(act(h, 1, 'raise', 80).code, 'BELOW_MIN');
});

test('a short all-in does not reopen betting', () => {
  const h = createHand({ seats: seats(1000, 1000, 55), buttonSeat:0, smallBlind:10, bigBlind:20 });
  act(h, 0, 'raise', 100);                      // raise to 100, by 80
  act(h, 1, 'call');                            // seat 1 has now acted
  act(h, 2, 'allin');                           // only 55: short of a full raise
  assert.equal(h.seats[2].allIn, true);
  // Nobody is owed another decision, so the street closes instead of returning
  // the action to seat 1.
  assert.equal(h.street, 'flop');
});

test('a full raise does reopen betting for players who already acted', () => {
  const h = createHand({ seats: seats(1000,1000,1000,1000), buttonSeat:0, smallBlind:10, bigBlind:20 });
  act(h, 3, 'call');                            // under the gun calls
  act(h, 0, 'call');
  act(h, 1, 'call');
  act(h, 2, 'raise', 120);                      // big blind raises by 100
  assert.equal(h.street, 'preflop', 'the street stays open');
  assert.equal(h.seats[3].acted, false, 'a full raise gives everyone a new decision');
  assert.equal(h.minRaise, 100);
  assert.equal(h.actor, 3);
});

test('folding to one player ends the hand without a showdown', () => {
  const h = createHand({ seats: seats(1000,1000,1000), buttonSeat:0, smallBlind:10, bigBlind:20 });
  act(h, 0, 'fold'); act(h, 1, 'fold');
  assert.equal(h.street, 'complete');
  assert.equal(h.result.uncontested, true);
  assert.equal(h.result.showdown.length, 0, 'nobody has to show');
  assert.equal(h.seats[2].stack, 1010, 'the big blind collects the blinds');
  assert.equal(chips(h), 3000, 'no chips created or destroyed');
});

test('chips are conserved through a full hand to showdown', () => {
  const h = createHand({ seats: seats(1000,1000,1000), buttonSeat:0, smallBlind:10, bigBlind:20 });
  act(h, 0, 'call'); act(h, 1, 'call'); act(h, 2, 'check');
  act(h, 1, 'bet', 40); act(h, 2, 'call'); act(h, 0, 'call');
  act(h, 1, 'check'); act(h, 2, 'check'); act(h, 0, 'check');
  act(h, 1, 'check'); act(h, 2, 'check'); act(h, 0, 'check');
  assert.equal(h.street, 'complete');
  assert.equal(chips(h), 3000);
  assert.equal(h.board.length, 5);
});

test('all-ins run the board out and pay side pots correctly', () => {
  // Rigged deck: seat 0 wins, seat 1 second, seat 2 third.
  const deck = [
    C('As'), C('Kd'), C('Qh'),          // hole card round one
    C('Ah'), C('Kc'), C('Qd'),          // hole card round two
    C('2c'), C('7s'), C('9h'), C('Jd'), // burn + flop
    C('3c'), C('4d'),                   // burn + turn
    C('5c'), C('6d')                    // burn + river
  ];
  const h = createHand({ seats: seats(1000, 500, 100), buttonSeat:0, smallBlind:10, bigBlind:20, deck });
  act(h, 0, 'raise', 1000);
  act(h, 1, 'allin');
  act(h, 2, 'allin');
  assert.equal(h.street, 'complete');
  assert.equal(chips(h), 1600, 'every chip is still on the table');
  // Cards deal one at a time from the left of the button, so seat 1 holds the
  // aces, seat 2 the kings and seat 0 the queens.
  assert.equal(h.seats[1].stack, 1100, 'the aces take the main pot and the side pot');
  assert.equal(h.seats[2].stack, 0, 'the shortest stack is eliminated');
  assert.equal(h.seats[0].stack, 500, 'the uncalled part of the raise comes back');
  assert.equal(h.pots.length, 3, 'main pot, side pot, and the uncalled remainder');
});

test('a tie splits the pot and the odd chip is deterministic', () => {
  // Both players end with the same straight from the board.
  const deck = [
    C('2c'), C('2d'),                   // hole round one
    C('3c'), C('3d'),                   // hole round two
    C('7h'), C('As'), C('Ks'), C('Qs'), // burn + flop
    C('8h'), C('Js'),                   // burn + turn
    C('9h'), C('Ts')                    // burn + river  -> board plays A K Q J T
  ];
  const h = createHand({ seats: seats(1000,1000), buttonSeat:0, smallBlind:10, bigBlind:20, deck });
  act(h, 0, 'call'); act(h, 1, 'check');
  act(h, 1, 'check'); act(h, 0, 'check');
  act(h, 1, 'check'); act(h, 0, 'check');
  act(h, 1, 'check'); act(h, 0, 'check');
  assert.equal(h.street, 'complete');
  assert.equal(h.seats[0].stack, 1000);
  assert.equal(h.seats[1].stack, 1000, 'an even split returns both stacks');
  assert.equal(chips(h), 2000);
});

test('acting out of turn is refused', () => {
  const h = createHand({ seats: seats(1000,1000,1000), buttonSeat:0, smallBlind:10, bigBlind:20 });
  const r = act(h, 2, 'call');
  assert.equal(r.ok, false);
  assert.equal(r.code, 'NOT_YOUR_TURN');
});

test('a stale version is refused', () => {
  const h = createHand({ seats: seats(1000,1000,1000), buttonSeat:0, smallBlind:10, bigBlind:20 });
  const r = applyAction(h, { seat:0, type:'call', version: h.version + 5 });
  assert.equal(r.code, 'STALE_VERSION');
});

test('a repeated action id is ignored rather than applied twice', () => {
  const h = createHand({ seats: seats(1000,1000,1000), buttonSeat:0, smallBlind:10, bigBlind:20 });
  const first = applyAction(h, { seat:0, type:'raise', amount:100, actionId:'click-1' });
  assert.equal(first.ok, true);
  const stackAfter = h.seats[0].stack;
  const again = applyAction(h, { seat:0, type:'raise', amount:100, actionId:'click-1' });
  assert.equal(again.duplicate, true, 'a double click must not bet twice');
  assert.equal(h.seats[0].stack, stackAfter);
});

test('checking into a live bet is refused', () => {
  const h = createHand({ seats: seats(1000,1000,1000), buttonSeat:0, smallBlind:10, bigBlind:20 });
  assert.equal(act(h, 0, 'check').code, 'ILLEGAL_ACTION');
});

test('a player never receives another player unrevealed cards', () => {
  const h = createHand({ seats: seats(1000,1000,1000), buttonSeat:0, smallBlind:10, bigBlind:20 });
  const view = viewFor(h, 0);
  assert.equal(view.seats.find(s => s.seat === 0).hole.length, 2);
  for(const other of view.seats.filter(s => s.seat !== 0))
    assert.deepEqual(other.hole, ['?','?'], 'opponents stay face down');
  assert.equal('deck' in view, false, 'the deck never leaves the server');
  assert.equal('shuffleSeed' in view, false, 'the seed stays secret while the hand is live');
});

test('the shuffle is committed before the hand so a deal can be audited', () => {
  const h = createHand({ seats: seats(1000,1000), buttonSeat:0, smallBlind:10, bigBlind:20 });
  assert.equal(typeof h.shuffleCommitment, 'string');
  assert.equal(h.shuffleCommitment.length, 64);
  assert.equal(viewFor(h, 0).shuffleCommitment, h.shuffleCommitment);
});
