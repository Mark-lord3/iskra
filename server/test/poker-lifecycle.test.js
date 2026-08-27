import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Tournament from '../src/models/PokerTournament.js';
import { canTransition, transition, resume, canRegister, issuanceKey, rankStandings } from '../src/poker/lifecycle.js';

const id = () => new mongoose.Types.ObjectId();

/* A tournament that satisfies every publication requirement. Individual tests
   break one thing at a time. */
function ready(overrides = {}){
  return new Tournament({
    title:'ISKRA Freeroll', slug:'iskra-freeroll-1', eventSlug:'iskra-night',
    registrationClosesAt:new Date('2026-09-01T22:00:00Z'),
    startsAt:new Date('2026-09-01T23:00:00Z'),
    legalReviewStatus:'approved', legalApprovedAt:new Date('2026-08-20T12:00:00Z'),
    legalReviewer:'counsel@example.com', rulesVersion:id(),
    ...overrides
  });
}

test('legal approval is required to publish', () => {
  const t = ready({ legalReviewStatus:'not_reviewed', legalApprovedAt:null });
  const r = transition(t, 'scheduled', { prizeCount:3 });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'PUBLICATION_BLOCKED');
  assert.ok(r.blockers.includes('LEGAL_NOT_APPROVED'));
});

test('being free is not by itself enough to publish', () => {
  // The whole point: noPurchaseNecessary true, but no legal sign-off yet.
  const t = ready({ legalReviewStatus:'in_review', legalApprovedAt:null });
  assert.equal(t.noPurchaseNecessary, true);
  assert.equal(transition(t, 'scheduled', { prizeCount:3 }).ok, false);
});

test('changes_requested blocks publication', () => {
  const t = ready({ legalReviewStatus:'changes_requested' });
  assert.ok(transition(t, 'scheduled', { prizeCount:3 }).blockers.includes('LEGAL_NOT_APPROVED'));
});

test('an approved tournament without a rules version still cannot publish', () => {
  const t = ready({ rulesVersion:null });
  assert.ok(transition(t, 'scheduled', { prizeCount:3 }).blockers.includes('NO_RULES_VERSION'));
});

test('publication requires all three placements configured', () => {
  const t = ready();
  assert.ok(transition(t, 'scheduled', { prizeCount:1 }).blockers.includes('NEEDS_THREE_PLACEMENTS'));
  assert.equal(transition(t, 'scheduled', { prizeCount:3 }).ok, true);
});

test('registration cannot close after the tournament starts', () => {
  const t = ready({ registrationClosesAt:new Date('2026-09-02T00:00:00Z') });
  assert.ok(transition(t, 'scheduled', { prizeCount:3 }).blockers.includes('REGISTRATION_AFTER_START'));
});

test('publishing stamps publishedAt and opening freezes the structure', () => {
  const t = ready();
  const now = new Date('2026-08-25T10:00:00Z');
  const pub = transition(t, 'scheduled', { prizeCount:3, now });
  assert.equal(pub.patch.publishedAt.toISOString(), now.toISOString());
  t.state = 'scheduled';
  const open = transition(t, 'registration_open', { prizeCount:3, now });
  assert.equal(open.patch.structureFrozenAt.toISOString(), now.toISOString());
});

test('the lifecycle cannot skip rounds', () => {
  assert.equal(canTransition('registration_locked','final_round').ok, false);
  assert.equal(canTransition('round_one','final_round').ok, false);
  assert.equal(canTransition('round_one','round_two').ok, true);
});

test('cancelled and voided are terminal', () => {
  for(const to of ['registration_open','round_one','completed'])
    assert.equal(canTransition('cancelled', to).ok, false, `cancelled -> ${to}`);
  assert.equal(canTransition('voided','completed').ok, false);
});

test('pause remembers where it came from and resume returns there', () => {
  const t = ready({ state:'round_two' });
  const paused = transition(t, 'paused', { prizeCount:3 });
  assert.equal(paused.patch.resumeState, 'round_two');
  t.state = 'paused'; t.resumeState = 'round_two';
  assert.deepEqual(resume(t), { ok:true, patch:{ state:'round_two', resumeState:null } });
});

test('resume refuses when nothing was recorded', () => {
  const t = ready({ state:'paused' });
  assert.equal(resume(t).code, 'NO_RESUME_STATE');
});

test('every transition is auditable', () => {
  const t = ready({ state:'round_one' });
  const r = transition(t, 'cancelled', { actor:'admin@iskra', reason:'venue closure' });
  assert.equal(r.audit.type, 'state_cancelled');
  assert.equal(r.audit.actor, 'admin@iskra');
  assert.equal(r.audit.reason, 'venue closure');
  assert.equal(r.patch.cancellationReason, 'venue closure');
});

/* --- registration --- */

const account = { emailVerified:true, ageConfirmed:true };

test('registration requires an account, verification and age confirmation', () => {
  const t = ready({ state:'registration_open' });
  const v = t.rulesVersion;
  const now = new Date('2026-08-30T12:00:00Z');
  const base = { tournament:t, acceptedRulesVersion:v, now };
  assert.equal(canRegister({ ...base, account:null }).code, 'ACCOUNT_REQUIRED');
  assert.equal(canRegister({ ...base, account:{ ...account, emailVerified:false } }).code, 'EMAIL_NOT_VERIFIED');
  assert.equal(canRegister({ ...base, account:{ ...account, ageConfirmed:false } }).code, 'AGE_NOT_CONFIRMED');
  assert.equal(canRegister({ ...base, account }).ok, true);
});

test('the rules must be accepted at the exact published version', () => {
  const t = ready({ state:'registration_open' });
  const now = new Date('2026-08-30T12:00:00Z');
  assert.equal(canRegister({ tournament:t, account, acceptedRulesVersion:id(), now }).code, 'RULES_NOT_ACCEPTED');
  assert.equal(canRegister({ tournament:t, account, acceptedRulesVersion:null, now }).code, 'RULES_NOT_ACCEPTED');
});

test('registration closes on the server clock, not the client', () => {
  const t = ready({ state:'registration_open' });
  const late = new Date('2026-09-01T22:00:01Z');   // one second past the close
  assert.equal(canRegister({ tournament:t, account, acceptedRulesVersion:t.rulesVersion, now:late }).code, 'REGISTRATION_CLOSED');
});

test('a second registration is refused', () => {
  const t = ready({ state:'registration_open' });
  const r = canRegister({ tournament:t, account, acceptedRulesVersion:t.rulesVersion,
    existingRegistration:{ _id:id() }, now:new Date('2026-08-30T12:00:00Z') });
  assert.equal(r.code, 'ALREADY_REGISTERED');
});

test('registration is closed while a tournament is paused', () => {
  const t = ready({ state:'paused' });
  assert.equal(t.registrationOpen(new Date('2026-08-30T12:00:00Z')), false);
});

/* --- prizes and standings --- */

test('the issuance key is stable for the same award and distinct across awards', () => {
  const tid = id(), uid = id();
  assert.equal(issuanceKey(tid, 1, uid), issuanceKey(tid, 1, uid));
  assert.notEqual(issuanceKey(tid, 1, uid), issuanceKey(tid, 2, uid));
  assert.notEqual(issuanceKey(tid, 1, uid), issuanceKey(id(), 1, uid));
});

test('standings rank by chips, then by surviving longer', () => {
  const ranked = rankStandings([
    { userId:'a', finishingChips:0, eliminationOrder:1 },
    { userId:'b', finishingChips:9000, eliminationOrder:null },
    { userId:'c', finishingChips:0, eliminationOrder:5 }
  ]);
  assert.deepEqual(ranked.map(p => p.userId), ['b','c','a']);
  assert.deepEqual(ranked.map(p => p.placement), [1,2,3]);
});

test('a true tie breaks deterministically on the committed seed', () => {
  const tied = [{ userId:'x', finishingChips:0, eliminationOrder:3 },
                { userId:'y', finishingChips:0, eliminationOrder:3 }];
  const a = rankStandings(tied, { seed:'seed-1' }).map(p => p.userId);
  const b = rankStandings(tied.slice().reverse(), { seed:'seed-1' }).map(p => p.userId);
  assert.deepEqual(a, b, 'same seed must give the same order regardless of input order');
});
