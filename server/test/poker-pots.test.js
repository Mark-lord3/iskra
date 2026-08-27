import { test } from 'node:test';
import assert from 'node:assert/strict';
import { awardPots, buildPots, splitPot } from '../src/poker/pots.js';

const P = (seat, committed, folded = false) => ({ seat, committed, folded });
const total = pots => pots.reduce((s, p) => s + p.amount, 0);

test('a single pot forms when everyone matches', () => {
  const pots = buildPots([P(0,100), P(1,100), P(2,100)]);
  assert.equal(pots.length, 1);
  assert.equal(pots[0].amount, 300);
  assert.deepEqual(pots[0].eligible, [0,1,2]);
});

test('a short all-in creates a main pot and one side pot', () => {
  const pots = buildPots([P(0,100), P(1,500), P(2,500)]);
  assert.equal(pots.length, 2);
  assert.equal(pots[0].amount, 300);              // 100 x 3
  assert.deepEqual(pots[0].eligible, [0,1,2]);
  assert.equal(pots[1].amount, 800);              // 400 x 2
  assert.deepEqual(pots[1].eligible, [1,2]);
  assert.equal(total(pots), 1100);
});

test('three different all-ins create three layers', () => {
  const pots = buildPots([P(0,50), P(1,200), P(2,600), P(3,600)]);
  assert.equal(total(pots), 1450);
  assert.deepEqual(pots.map(p => p.amount), [200, 450, 800]);
  assert.deepEqual(pots.map(p => p.eligible), [[0,1,2,3], [1,2,3], [2,3]]);
});

test('chips from a folded player stay in the pot but win nothing', () => {
  const pots = buildPots([P(0,100,true), P(1,100), P(2,100)]);
  assert.equal(total(pots), 300, 'the folded chips are still in play');
  assert.deepEqual(pots[0].eligible, [1,2], 'but the folder cannot win them');
});

test('a folded short stack still funds the main pot', () => {
  const pots = buildPots([P(0,40,true), P(1,300), P(2,300)]);
  assert.equal(total(pots), 640);
  for(const pot of pots) assert.equal(pot.eligible.includes(0), false);
});

test('no chip is ever created or destroyed', () => {
  // Random commitments, repeatedly: the layers must always sum to the input.
  for(let trial = 0; trial < 400; trial++){
    const players = Array.from({ length: 2 + (trial % 8) }, (_, seat) =>
      P(seat, Math.floor(Math.random() * 900) + 1, Math.random() < 0.3));
    const sum = players.reduce((s, p) => s + p.committed, 0);
    assert.equal(total(buildPots(players)), sum);
  }
});

test('an odd chip goes to the first winner left of the button', () => {
  const split = splitPot(101, [3, 5], [3, 5, 7]);       // seat 3 acts first
  assert.equal(split.get(3), 51);
  assert.equal(split.get(5), 50);
  const other = splitPot(101, [3, 5], [5, 7, 3]);        // seat 5 acts first
  assert.equal(other.get(5), 51);
  assert.equal(other.get(3), 50);
});

test('a three-way split distributes the remainder deterministically', () => {
  const split = splitPot(100, [0,1,2], [0,1,2]);
  assert.deepEqual([...split.values()], [34, 33, 33]);
  assert.equal([...split.values()].reduce((a,b)=>a+b,0), 100);
});

test('awarding pays the best eligible hand in every layer', () => {
  const pots = buildPots([P(0,100), P(1,500), P(2,500)]);
  // Seat 0 has the best hand but is only eligible for the main pot.
  const rank = seats => {
    const order = [0, 2, 1].filter(s => seats.includes(s));
    return order.map(s => [s]);
  };
  const { payouts } = awardPots(pots, rank, [0,1,2]);
  assert.equal(payouts.get(0), 300, 'short stack takes only the main pot');
  assert.equal(payouts.get(2), 800, 'the side pot goes to the best of the rest');
  assert.equal(payouts.get(1), undefined);
  assert.equal([...payouts.values()].reduce((a,b)=>a+b,0), 1100);
});

test('a tie splits each pot independently', () => {
  const pots = buildPots([P(0,100), P(1,100), P(2,100)]);
  const rank = seats => [seats.filter(s => s !== 2), [2]];   // 0 and 1 tie
  const { payouts } = awardPots(pots, rank, [0,1,2]);
  assert.equal(payouts.get(0), 150);
  assert.equal(payouts.get(1), 150);
  assert.equal(payouts.get(2), undefined);
});

test('everything folding to one player awards the whole pot', () => {
  const pots = buildPots([P(0,50,true), P(1,50,true), P(2,50)]);
  const { payouts } = awardPots(pots, seats => [seats], [0,1,2]);
  assert.equal(payouts.get(2), 150);
});
