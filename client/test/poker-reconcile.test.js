import test from 'node:test';
import assert from 'node:assert/strict';
import { stateRank, isNewer, reconcile, isBigJump } from '../src/poker/reconcile.js';

const at = (handNumber, version, street='flop') =>
  ({ tableId:'t1', handNumber, hand:{ handId:`h${handNumber}`, version, street } });

test('a later hand always outranks an earlier one', () => {
  assert.equal(isNewer(at(2, 0), at(1, 99)), true);
  assert.equal(isNewer(at(1, 99), at(2, 0)), false);
});

test('within a hand, the higher version wins', () => {
  assert.equal(isNewer(at(1, 5), at(1, 4)), true);
  assert.equal(isNewer(at(1, 4), at(1, 5)), false);
});

test('a late snapshot never rewinds the table', () => {
  const current = at(1, 7);
  const { state, changed } = reconcile(current, at(1, 3));
  assert.equal(changed, false);
  assert.equal(state, current, 'the newer state is kept untouched');
});

test('an identical snapshot is not treated as a change', () => {
  const current = at(1, 7);
  assert.equal(reconcile(current, at(1, 7)).changed, false);
});

test('a finished hand outranks the same hand still in progress', () => {
  const playing = { ...at(1, 9), hand:{ handId:'h1', version:9, street:'river' } };
  const done = { ...at(1, 9), hand:{ handId:'h1', version:9, street:'complete' } };
  assert.equal(isNewer(done, playing), true);
  assert.equal(isNewer(playing, done), false);
});

test('the first snapshot is always accepted', () => {
  assert.equal(isNewer(at(1, 0), null), true);
  assert.equal(reconcile(null, at(1, 0)).changed, true);
});

test('a null incoming snapshot is ignored', () => {
  const current = at(1, 4);
  assert.deepEqual(reconcile(current, null), { state: current, changed: false });
  assert.equal(isNewer(null, current), false);
});

test('a snapshot from a different table replaces rather than compares', () => {
  const here = at(5, 20);
  const elsewhere = { ...at(1, 0), tableId:'t2' };
  assert.equal(isNewer(elsewhere, here), true, 'moving tables is not a rewind');
});

test('a demo snapshot ranks on hands played', () => {
  const first = { handsPlayed:1, hand:{ version:2, street:'flop' } };
  const second = { handsPlayed:2, hand:{ version:0, street:'preflop' } };
  assert.equal(isNewer(second, first), true);
  assert.deepEqual(stateRank(first), [1, 2, 0]);
});

test('a gap of more than one hand is a big jump', () => {
  assert.equal(isBigJump(at(1, 3), at(3, 0)), true);
  assert.equal(isBigJump(at(1, 3), at(2, 0)), false);
});

test('a long version gap inside one hand is a big jump', () => {
  assert.equal(isBigJump(at(1, 1), at(1, 9)), true, 'reconnecting mid-hand must not replay it');
  assert.equal(isBigJump(at(1, 1), at(1, 3)), false, 'ordinary play animates step by step');
});

test('a missing side of the comparison counts as a big jump', () => {
  assert.equal(isBigJump(null, at(1, 0)), true);
  assert.equal(isBigJump(at(1, 0), null), true);
});
