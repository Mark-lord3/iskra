import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contestCloseAt,
  contestPublic,
  CUTOFF_DAYS,
  hasOpenContestWindow,
  PENDING_EVENT_SLUG,
} from '../src/lib/arcadeContest.js';
import {PRIZES,prizeForRank} from '../src/lib/prizes.js';

test('an event arcade competition closes exactly seven days before the event',()=>{
  assert.equal(CUTOFF_DAYS,7);
  assert.equal(contestCloseAt('2026-09-20T22:00:00.000Z').toISOString(),'2026-09-13T22:00:00.000Z');
});

test('only events with a future competition cutoff can claim the holding board',()=>{
  const now=new Date('2026-08-27T14:00:00.000Z');
  assert.equal(hasOpenContestWindow('2026-08-28T22:00:00.000Z',now),false);
  assert.equal(hasOpenContestWindow('2026-09-04T22:00:00.000Z',now),true);
});

test('pre-schedule contest stays playable without exposing placeholder event data',()=>{
  const contest = contestPublic({
    _id:'pending-contest',
    eventSlug:PENDING_EVENT_SLUG,
    eventTitle:'Next Project ISKRA event',
    eventDate:new Date('2100-01-01T00:00:00.000Z'),
    opensAt:new Date('2026-08-26T00:00:00.000Z'),
    closesAt:new Date('2099-12-25T00:00:00.000Z'),
    status:'open',
    minParticipants:30,
    participantCount:4,
    finalizedAt:null,
  });

  assert.equal(contest.assigned,false);
  assert.equal(contest.eventSlug,null);
  assert.equal(contest.eventDate,null);
  assert.equal(contest.closesAt,null);
  assert.equal(contest.entriesNeeded,26);
});

test('final arcade ranks map to the requested event rewards',()=>{
  assert.equal(prizeForRank(1),PRIZES.top1);
  assert.equal(prizeForRank(2),PRIZES.top2);
  for(const rank of [3,4,5])assert.equal(prizeForRank(rank),PRIZES.top5);
  assert.equal(prizeForRank(6),PRIZES.played);
  assert.deepEqual([PRIZES.top1.off,PRIZES.top2.off,PRIZES.top5.off,PRIZES.played.off],[1,.5,.4,.1]);
  for(const prize of Object.values(PRIZES))assert.equal(prize.maxQty,1);
});
