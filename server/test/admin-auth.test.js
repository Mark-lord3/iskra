import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import 'dotenv/config';
import mongoose from 'mongoose';
import Admin from '../src/models/Admin.js';
import ScannerSession from '../src/models/ScannerSession.js';
import { hashPassword } from '../src/lib/adminAuth.js';

const API = process.env.TEST_API || 'http://localhost:4310';
const EMAIL = 'auth-test@iskra.local';
const PASSWORD = 'a-long-enough-password';

const post = (path, body, cookie) => fetch(API + path, {
  method:'POST',
  headers:{ 'Content-Type':'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  body: JSON.stringify(body)
});
const cookieFrom = res => (res.headers.get('set-cookie') || '').split(';')[0];

before(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  await Admin.deleteMany({ email: EMAIL });
  await Admin.create({ email: EMAIL, name:'Auth Test', passwordHash: await hashPassword(PASSWORD) });
});
after(async () => {
  await Admin.deleteMany({ email: EMAIL });
  await ScannerSession.deleteMany({ label: /Passcode test/ });
  await mongoose.disconnect();
});

test('the dashboard is closed without a session', async () => {
  const res = await fetch(API + '/api/admin/summary');
  assert.equal(res.status, 401);
});

test('the retired shared key no longer opens anything', async () => {
  for (const init of [
    { headers:{ 'x-admin-key':'iskra-local-admin' } },
    {}
  ]) {
    const res = await fetch(API + '/api/admin/summary?key=iskra-local-admin', init);
    assert.equal(res.status, 401, 'a shared key must not authorise the dashboard');
  }
});

test('a wrong password is refused', async () => {
  const res = await post('/api/auth/login', { email: EMAIL, password:'not-it' });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).code, 'BAD_CREDENTIALS');
});

test('an unknown address gives the same answer as a wrong password', async () => {
  const res = await post('/api/auth/login', { email:'ghost@nowhere.local', password:'whatever' });
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.code, 'BAD_CREDENTIALS', 'the reply must not reveal whether the account exists');
});

test('correct credentials return an httpOnly, same-site session cookie', async () => {
  const res = await post('/api/auth/login', { email: EMAIL, password: PASSWORD });
  assert.equal(res.status, 200);
  const raw = res.headers.get('set-cookie') || '';
  assert.match(raw, /iskra_admin_session=/);
  assert.match(raw, /HttpOnly/i);
  assert.match(raw, /SameSite=Strict/i);
  const body = await res.json();
  assert.equal(body.admin.email, EMAIL);
  assert.equal('passwordHash' in body.admin, false);
});

test('the session opens the dashboard, and logout closes it', async () => {
  const login = await post('/api/auth/login', { email: EMAIL, password: PASSWORD });
  const cookie = cookieFrom(login);
  const open = await fetch(API + '/api/admin/summary', { headers:{ Cookie: cookie } });
  assert.equal(open.status, 200);
  await post('/api/auth/logout', {}, cookie);
});

test('a forged session cookie is rejected', async () => {
  const res = await fetch(API + '/api/admin/summary',
    { headers:{ Cookie:'iskra_admin_session=not.a.real.jwt' } });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).code, 'EXPIRED');
});

test('repeated failures lock the account, and the lock is reported', async () => {
  const email = 'lockout-test@iskra.local';
  await Admin.deleteMany({ email });
  await Admin.create({ email, passwordHash: await hashPassword(PASSWORD) });
  let locked = false;
  for (let i = 0; i < 6; i++) {
    const res = await post('/api/auth/login', { email, password:'wrong' });
    if (res.status === 423) { locked = true; break; }
  }
  assert.equal(locked, true, 'the account should lock after repeated failures');
  // even the right password is refused while locked
  const res = await post('/api/auth/login', { email, password: PASSWORD });
  assert.equal(res.status, 423);
  await Admin.deleteMany({ email });
});

test('an admin session does not authorise the door API', async () => {
  const login = await post('/api/auth/login', { email: EMAIL, password: PASSWORD });
  const res = await fetch(API + '/api/staff/redeem', {
    method:'POST', headers:{ 'Content-Type':'application/json', Cookie: cookieFrom(login) },
    body: JSON.stringify({ code:'anything' })
  });
  assert.equal(res.status, 401, 'the two roles use separate credentials in both directions');
});

test('the scanner passcode opens the scanner only', async () => {
  const passcode = process.env.SCANNER_PASSCODE;
  if (!passcode) return;                       // feature switched off
  const bad = await post('/api/staff/passcode', { passcode:'000000', label:'Passcode test' });
  assert.equal(bad.status, 401);

  const good = await post('/api/staff/passcode', { passcode, label:'Passcode test' });
  assert.equal(good.status, 201);
  const { token } = await good.json();

  const scan = await fetch(API + '/api/staff/verify', {
    method:'POST', headers:{ 'Content-Type':'application/json', 'x-scanner-token': token },
    body: JSON.stringify({ code:'' })
  });
  assert.equal(scan.status, 400, 'the passcode session reaches the scanner');

  const admin = await fetch(API + '/api/admin/summary', { headers:{ 'x-scanner-token': token } });
  assert.equal(admin.status, 401, 'the passcode must not open the dashboard');
});

test('the scanner passcode is not the admin password', async () => {
  const passcode = process.env.SCANNER_PASSCODE;
  if (!passcode) return;
  assert.notEqual(passcode, process.env.ADMIN_PASSWORD,
    'door staff must never hold the administrator password');
});
