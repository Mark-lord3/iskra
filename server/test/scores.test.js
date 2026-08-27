import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSubmission, MAX_SCORE, MAX_PER_HIT, MIN_GAP_MS }
  from '../src/routes/scores.js';

const good = { score: 24000, hits: 60, bestMult: 4, durationMs: 60000 };

test('a plausible round is accepted', () => {
  assert.equal(validateSubmission(good).ok, true);
});

test('scores outside the possible range are rejected', () => {
  assert.equal(validateSubmission({ ...good, score: MAX_SCORE + 1 }).code, 'SCORE_RANGE');
  assert.equal(validateSubmission({ ...good, score: -5 }).code, 'SCORE_RANGE');
  assert.equal(validateSubmission({ ...good, score: 12.5 }).code, 'SCORE_RANGE');
  assert.equal(validateSubmission({ ...good, score: '900000' }).code, 'SCORE_RANGE');
});

test('a score that no number of hits could produce is rejected', () => {
  // 10 hits can never be worth more than 10 x MAX_PER_HIT
  assert.equal(validateSubmission({ ...good, score: 10 * MAX_PER_HIT + 1, hits: 10 }).code, 'SCORE_HITS');
  assert.equal(validateSubmission({ ...good, score: 5000, hits: 0 }).code, 'SCORE_HITS');
});

test('impossible round durations are rejected', () => {
  assert.equal(validateSubmission({ ...good, durationMs: 2000 }).code, 'DURATION');
  assert.equal(validateSubmission({ ...good, durationMs: 600000 }).code, 'DURATION');
});

test('multipliers outside 1x to 5x are rejected', () => {
  assert.equal(validateSubmission({ ...good, bestMult: 0 }).code, 'MULT_RANGE');
  assert.equal(validateSubmission({ ...good, bestMult: 9 }).code, 'MULT_RANGE');
});

test('hit counts outside the possible range are rejected', () => {
  assert.equal(validateSubmission({ ...good, hits: -1 }).code, 'HITS_RANGE');
  assert.equal(validateSubmission({ ...good, hits: 5000 }).code, 'HITS_RANGE');
});

test('a round submitted before the previous one could have finished is rejected', () => {
  const now = Date.now();
  assert.equal(validateSubmission(good, { lastPlayAt: new Date(now - 1000), now }).code, 'TOO_FAST');
  assert.equal(validateSubmission(good, { lastPlayAt: new Date(now - MIN_GAP_MS - 1), now }).ok, true);
});

test('validation never trusts a client-sent rank or reward', () => {
  const r = validateSubmission({ ...good, rank: 1, reward: 'ISKRA10' });
  assert.equal(r.ok, true);
  assert.equal('rank' in r, false);
  assert.equal('reward' in r, false);
});
