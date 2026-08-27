import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import 'dotenv/config';
import mongoose from 'mongoose';
import Ticket from '../src/models/Ticket.js';
import ScannerSession from '../src/models/ScannerSession.js';
import { createInvite, hashToken } from '../src/lib/scannerAuth.js';

const API = process.env.TEST_API || 'http://localhost:4310';
const call = async (path, { method='POST', token, body } = {}) => {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type':'application/json', ...(token ? { 'x-scanner-token': token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

let token;
const made = [];

const makeTicket = async (over = {}) => {
  const ref = 'ISKRA-TEST-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const t = await Ticket.create({
    reference: ref,
    accessToken: crypto.randomBytes(12).toString('hex'),
    qrSecret: crypto.randomBytes(9).toString('base64url'),
    qrPayload: `ISKRA:${ref}:${crypto.randomBytes(9).toString('base64url')}`,
    eventSlug:'scanner-test', eventTitle:'Scanner Test Night',
    eventDate: new Date(Date.now() + 3600_000),
    buyerName:'Door Guest', buyerEmail:'guest@test.local',
    tier:'General admission', price:0, status:'reserved', ...over
  });
  made.push(t._id);
  return t;
};

before(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const r = await call('/api/staff/session', { body:{ invite: createInvite({ label:'Test door' }) } });
  assert.equal(r.status, 201, 'session exchange should succeed');
  token = r.body.token;
});

after(async () => {
  await Ticket.deleteMany({ _id: { $in: made } });
  await ScannerSession.deleteMany({ label: /^Test door/ });
  await mongoose.disconnect();
});

test('a valid ticket is admitted exactly once', async () => {
  const t = await makeTicket();
  const first = await call('/api/staff/redeem', { token, body:{ code: t.qrPayload } });
  assert.equal(first.status, 200);
  assert.equal(first.body.outcome, 'admitted');
  assert.equal(first.body.ticket.reference, t.reference);
  const stored = await Ticket.findById(t._id).lean();
  assert.equal(stored.status, 'redeemed');
  assert.ok(stored.redeemedAt);
});

test('a second scan reports already used with the authoritative timestamp', async () => {
  const t = await makeTicket();
  await call('/api/staff/redeem', { token, body:{ code: t.qrPayload } });
  const again = await call('/api/staff/redeem', { token, body:{ code: t.qrPayload } });
  assert.equal(again.status, 409);
  assert.equal(again.body.outcome, 'already_used');
  const stored = await Ticket.findById(t._id).lean();
  assert.equal(new Date(again.body.ticket.redeemedAt).getTime(), stored.redeemedAt.getTime());
});

test('simultaneous scans of one ticket admit exactly one', async () => {
  const t = await makeTicket();
  const results = await Promise.all(
    Array.from({ length: 8 }, () => call('/api/staff/redeem', { token, body:{ code: t.qrPayload } }))
  );
  const admitted = results.filter(r => r.body.outcome === 'admitted');
  const used = results.filter(r => r.body.outcome === 'already_used');
  assert.equal(admitted.length, 1, 'exactly one device may admit');
  assert.equal(used.length, 7);
});

test('verify never changes ticket state', async () => {
  const t = await makeTicket();
  const r = await call('/api/staff/verify', { token, body:{ code: t.qrPayload } });
  assert.equal(r.body.outcome, 'valid');
  const stored = await Ticket.findById(t._id).lean();
  assert.equal(stored.status, 'reserved');
  assert.equal(stored.redeemedAt, null);
});

test('unknown codes are invalid', async () => {
  const r = await call('/api/staff/redeem', { token, body:{ code:'ISKRA:NOPE:NOPE' } });
  assert.equal(r.status, 404);
  assert.equal(r.body.outcome, 'invalid');
});

test('cancelled tickets are refused', async () => {
  const t = await makeTicket({ status:'cancelled' });
  const r = await call('/api/staff/redeem', { token, body:{ code: t.qrPayload } });
  assert.equal(r.status, 409);
  assert.equal(r.body.outcome, 'cancelled');
});

test('tickets for a past night are refused', async () => {
  const t = await makeTicket({ eventDate: new Date(Date.now() - 48 * 3600_000) });
  const r = await call('/api/staff/redeem', { token, body:{ code: t.qrPayload } });
  assert.equal(r.body.outcome, 'expired');
});

test('a device scoped to one event refuses another night', async () => {
  const scoped = await call('/api/staff/session',
    { body:{ invite: createInvite({ label:'Test door scoped', eventSlug:'some-other-night' }) } });
  const t = await makeTicket();
  const r = await call('/api/staff/redeem', { token: scoped.body.token, body:{ code: t.qrPayload } });
  assert.equal(r.body.outcome, 'wrong_event');
  const stored = await Ticket.findById(t._id).lean();
  assert.equal(stored.status, 'reserved', 'a wrong-event scan must not redeem');
});

test('a missing session is rejected', async () => {
  const r = await call('/api/staff/redeem', { body:{ code:'anything' } });
  assert.equal(r.status, 401);
  assert.equal(r.body.code, 'NO_SESSION');
});

test('a revoked device is rejected', async () => {
  const s = await call('/api/staff/session', { body:{ invite: createInvite({ label:'Test door revoke' }) } });
  await ScannerSession.updateOne({ tokenHash: hashToken(s.body.token) }, { revokedAt: new Date() });
  const r = await call('/api/staff/redeem', { token: s.body.token, body:{ code:'x' } });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'REVOKED');
});

test('an expired device session is rejected', async () => {
  const s = await call('/api/staff/session', { body:{ invite: createInvite({ label:'Test door expiry' }) } });
  await ScannerSession.updateOne({ tokenHash: hashToken(s.body.token) }, { expiresAt: new Date(Date.now() - 1000) });
  const r = await call('/api/staff/redeem', { token: s.body.token, body:{ code:'x' } });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'EXPIRED');
});

test('an invalid invite cannot create a session', async () => {
  const r = await call('/api/staff/session', { body:{ invite:'forged.token' } });
  assert.equal(r.status, 401);
  assert.equal(r.body.code, 'BAD_INVITE');
});

test('a scanner token cannot reach the admin API', async () => {
  const res = await fetch(API + '/api/admin/summary', { headers:{ 'x-scanner-token': token } });
  assert.equal(res.status, 401, 'door devices must not read admin data');
});

test('the door response exposes no buyer email, price or order', async () => {
  const t = await makeTicket();
  const r = await call('/api/staff/verify', { token, body:{ code: t.qrPayload } });
  const keys = Object.keys(r.body.ticket);
  for (const leak of ['buyerEmail','email','price','orderId','stripeSessionId','accessToken','qrSecret','qrPayload'])
    assert.equal(keys.includes(leak), false, `${leak} must not reach a door device`);
});
