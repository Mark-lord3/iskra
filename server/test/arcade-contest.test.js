import test from 'node:test';
import assert from 'node:assert/strict';
import {contestCloseAt,CUTOFF_DAYS} from '../src/lib/arcadeContest.js';
import {PRIZES,prizeForRank} from '../src/lib/prizes.js';

test('an event arcade competition closes exactly seven days before the event',()=>{
  assert.equal(CUTOFF_DAYS,7);
  assert.equal(contestCloseAt('2026-09-20T22:00:00.000Z').toISOString(),'2026-09-13T22:00:00.000Z');
});

test('final arcade ranks map to the requested event rewards',()=>{
  assert.equal(prizeForRank(1),PRIZES.top1);
  assert.equal(prizeForRank(2),PRIZES.top2);
  for(const rank of [3,4,5])assert.equal(prizeForRank(rank),PRIZES.top5);
  assert.equal(prizeForRank(6),PRIZES.played);
  assert.deepEqual([PRIZES.top1.off,PRIZES.top2.off,PRIZES.top5.off,PRIZES.played.off],[1,.5,.4,.1]);
  for(const prize of Object.values(PRIZES))assert.equal(prize.maxQty,1);
});
