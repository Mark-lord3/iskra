import test from 'node:test';
import assert from 'node:assert/strict';
import { contestBadge, msUntilClose, canPlay, canRegister, participantMeter,
         countdownParts, rewardZone, closedState, LADDER, CLOSING_SOON_MS }
  from '../src/arcade/contest.js';

const C = (over = {}) => ({
  status:'open', closesAt:new Date(Date.now() + 7 * 86400_000).toISOString(),
  minParticipants:30, participantCount:0, entriesNeeded:30, ...over
});

/* --------------------------------------------------------------- the badge */

test('an open competition well before closing reads as open', () => {
  assert.deepEqual(contestBadge(C()), { key:'open', tone:'open' });
});

test('an open competition inside the last day reads as closing soon', () => {
  const now = Date.now();
  const soon = C({ closesAt:new Date(now + 3600_000).toISOString() });
  assert.equal(contestBadge(soon, now).key, 'closing_soon');
  const later = C({ closesAt:new Date(now + CLOSING_SOON_MS + 60_000).toISOString() });
  assert.equal(contestBadge(later, now).key, 'open');
});

test('a closed competition short of its minimum says so', () => {
  const badge = contestBadge(C({ status:'closed_pending', entriesNeeded:30 }));
  assert.deepEqual(badge, { key:'awaiting_minimum', tone:'wait' });
});

test('a closed competition that met its minimum is simply closed', () => {
  const badge = contestBadge(C({ status:'closed_pending', entriesNeeded:0, participantCount:30 }));
  assert.equal(badge.key, 'closed');
});

test('finalizing and finalized are distinct', () => {
  assert.equal(contestBadge(C({ status:'finalizing' })).key, 'closed');
  assert.deepEqual(contestBadge(C({ status:'finalized' })), { key:'finalized', tone:'final' });
});

test('no competition at all is never announced as open', () => {
  assert.deepEqual(contestBadge(null), { key:'none', tone:'closed' });
  assert.equal(contestBadge(C({ status:'nonsense' })).key, 'none');
});

/* ---------------------------------------------------------- play is gated */

test('play is only ever possible while the competition is open', () => {
  for(const status of ['closed_pending','finalizing','finalized','nonsense'])
    assert.equal(canPlay(C({ status }), 3, 'ready'), false, status);
  assert.equal(canPlay(null, 3, 'ready'), false);
  assert.equal(canPlay(C(), 3, 'ready'), true);
});

test('a closed competition offers no registration form', () => {
  assert.equal(canRegister(C()), true);
  for(const status of ['closed_pending','finalizing','finalized'])
    assert.equal(canRegister(C({ status })), false, status);
  assert.equal(canRegister(null), false);
});

test('spent credits stop play even while the competition is open', () => {
  assert.equal(canPlay(C(), 0, 'ready'), false);
  assert.equal(canPlay(C(), -1, 'ready'), false);
  assert.equal(canPlay(C(), null, 'ready'), false);
});

test('play cannot start again while a round or a submission is in flight', () => {
  for(const screen of ['playing','submitting','loading'])
    assert.equal(canPlay(C(), 3, screen), false, screen);
});

/* ------------------------------------------------------------- the meter */

test('the participant meter charges towards the minimum', () => {
  assert.deepEqual(participantMeter(C({ participantCount:0 })),
    { count:0, min:30, needed:30, percent:0, reached:false });
  assert.deepEqual(participantMeter(C({ participantCount:15, entriesNeeded:15 })),
    { count:15, min:30, needed:15, percent:50, reached:false });
});

test('reaching the minimum fills the meter and reports completion', () => {
  const meter = participantMeter(C({ participantCount:30, entriesNeeded:0 }));
  assert.equal(meter.percent, 100);
  assert.equal(meter.reached, true);
  // Going past the minimum never overfills.
  assert.equal(participantMeter(C({ participantCount:99, entriesNeeded:0 })).percent, 100);
});

test('a missing competition still yields a drawable meter', () => {
  const meter = participantMeter(null);
  assert.equal(meter.percent, 0);
  assert.ok(Number.isFinite(meter.percent));
  assert.equal(meter.reached, false);
});

/* --------------------------------------------------------- the countdown */

test('the countdown splits into days, hours, minutes and seconds', () => {
  assert.deepEqual(countdownParts(90_061_000), { days:1, hours:1, minutes:1, seconds:1 });
  assert.deepEqual(countdownParts(0), { days:0, hours:0, minutes:0, seconds:0 });
  assert.deepEqual(countdownParts(null), { days:0, hours:0, minutes:0, seconds:0 });
});

test('a competition that already closed counts down to zero, not below', () => {
  const past = C({ closesAt:new Date(Date.now() - 86400_000).toISOString() });
  assert.equal(msUntilClose(past), 0);
  assert.equal(msUntilClose(C({ closesAt:null })), null);
});

/* ------------------------------------------------------- the reward ladder */

test('the reward zone mirrors the server prize tiers', () => {
  assert.equal(rewardZone(1), 'top1');
  assert.equal(rewardZone(2), 'top2');
  for(const rank of [3,4,5]) assert.equal(rewardZone(rank), 'top5');
  assert.equal(rewardZone(6), 'played');
  assert.equal(rewardZone(999), 'played');
});

test('an unranked player sits in no reward zone', () => {
  assert.equal(rewardZone(null), null);
  assert.equal(rewardZone(0), null);
});

test('the ladder covers every tier the server can award', () => {
  assert.deepEqual(LADDER.map(l => l.key), ['top1','top2','top5','played']);
});

/* --------------------------------------------------------- the closed panel */

test('the closed panel explains which kind of closed this is', () => {
  assert.equal(closedState(C({ status:'closed_pending', entriesNeeded:12 })).key, 'awaiting_minimum');
  assert.equal(closedState(C({ status:'finalizing' })).key, 'finalizing');
  assert.equal(closedState(C({ status:'finalized' }), false).key, 'finalized');
  assert.equal(closedState(C({ status:'finalized' }), true).key, 'finalized_reward');
  assert.equal(closedState(null).key, 'no_event');
});

test('every closed state offers a way onward', () => {
  const withAction = ['closed_pending','finalizing','finalized'];
  for(const status of withAction){
    const state = closedState(C({ status, entriesNeeded: status === 'closed_pending' ? 5 : 0 }));
    assert.ok(state.action, `${status} must offer somewhere to go`);
    assert.ok(['final_board','next_competition'].includes(state.action));
  }
});
