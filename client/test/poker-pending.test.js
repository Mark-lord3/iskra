import test from 'node:test';
import assert from 'node:assert/strict';
import { createPending, beginAction, settleAction, timeoutAction,
         isPending, pendingMove, retryId } from '../src/poker/pending.js';

test('an action is allowed when nothing is in flight', () => {
  const start = beginAction(createPending(), { type:'call', amount:100 });
  assert.equal(start.allowed, true);
  assert.ok(start.action.actionId, 'an idempotency key is generated');
  assert.equal(isPending(start.pending), true);
});

test('a second action is refused while the first is unanswered', () => {
  const first = beginAction(createPending(), { type:'raise', amount:300 });
  const second = beginAction(first.pending, { type:'raise', amount:300 });
  assert.equal(second.allowed, false);
  assert.equal(second.reason, 'IN_FLIGHT');
  assert.equal(second.pending, first.pending, 'the guard does not change state on refusal');
});

test('a double click cannot send two bets', () => {
  let pending = createPending();
  const sent = [];
  for(let i = 0; i < 5; i++){
    const step = beginAction(pending, { type:'bet', amount:500 });
    pending = step.pending;
    if(step.allowed) sent.push(step.action);
  }
  assert.equal(sent.length, 1, 'five clicks, one bet');
});

test('the next action is allowed once the server answers', () => {
  const first = beginAction(createPending(), { type:'check' });
  const settled = settleAction(first.pending, first.action.actionId, { ok:true });
  assert.equal(isPending(settled), false);
  assert.equal(settled.last.outcome, 'accepted');
  assert.equal(beginAction(settled, { type:'bet', amount:50 }).allowed, true);
});

test('a rejection is recorded with its reason', () => {
  const first = beginAction(createPending(), { type:'raise', amount:200 });
  const settled = settleAction(first.pending, first.action.actionId, { ok:false, code:'STALE_VERSION' });
  assert.equal(settled.last.outcome, 'rejected');
  assert.equal(settled.last.code, 'STALE_VERSION');
  assert.equal(isPending(settled), false, 'a rejected action must not lock the player out');
});

test('a reply for a different action is ignored', () => {
  const first = beginAction(createPending(), { type:'call' });
  const stale = settleAction(first.pending, 'some-other-id', { ok:true });
  assert.equal(stale, first.pending, 'a late reply cannot clear the current action');
  assert.equal(isPending(stale), true);
});

test('a request that never returns releases the turn and says why', () => {
  const first = beginAction(createPending(), { type:'call' });
  const timedOut = timeoutAction(first.pending, first.action.actionId);
  assert.equal(isPending(timedOut), false);
  assert.equal(timedOut.last.code, 'TIMEOUT');
});

test('the pending move is readable while it is in flight', () => {
  const first = beginAction(createPending(), { type:'allin', amount:9000 });
  assert.equal(pendingMove(first.pending), 'allin');
  assert.equal(pendingMove(settleAction(first.pending, first.action.actionId, { ok:true })), null);
});

test('a retry reuses the original id so the server sees one action', () => {
  const first = beginAction(createPending(), { type:'bet', amount:100 });
  const failed = settleAction(first.pending, first.action.actionId, { ok:false, code:'TIMEOUT' });
  assert.equal(retryId(failed), first.action.actionId);

  const retried = beginAction(failed, { type:'bet', amount:100, actionId: retryId(failed) });
  assert.equal(retried.action.actionId, first.action.actionId);
});

test('a supplied id is respected rather than replaced', () => {
  const start = beginAction(createPending(), { type:'fold', actionId:'fixed-id' });
  assert.equal(start.action.actionId, 'fixed-id');
});
