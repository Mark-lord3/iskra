import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import 'dotenv/config';
import mongoose from 'mongoose';
import ScannerSession from '../src/models/ScannerSession.js';
import { createInvite } from '../src/lib/scannerAuth.js';

const API = process.env.TEST_API || 'http://localhost:4310';
let token;

before(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const res = await fetch(API + '/api/staff/session', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ invite: createInvite({ label:'Boundary door' }) })
  });
  token = (await res.json()).token;
});
after(async () => {
  await ScannerSession.deleteMany({ label:'Boundary door' });
  await mongoose.disconnect();
});

const asScanner = (path, method='GET') => fetch(API + path, {
  method,
  headers:{ 'Content-Type':'application/json', 'x-scanner-token': token },
  body: method === 'GET' ? undefined : '{}'
});

/**
 * Every administrative surface, probed with a valid door token. A bouncer's
 * phone must be turned away from all of them.
 */
const ADMIN_SURFACES = [
  ['/api/admin/summary','GET'],
  ['/api/admin/scanner/sessions','GET'],
  ['/api/admin/scanner/log','GET'],
  ['/api/admin/scanner/link','POST'],
  ['/api/admin/events','POST'],
  ['/api/admin/banners','POST'],
  ['/api/admin/gallery','POST'],
  ['/api/admin/site-status','POST']
];

test('a door token cannot reach any admin surface', async () => {
  for (const [path, method] of ADMIN_SURFACES) {
    const res = await asScanner(path, method);
    assert.ok(res.status === 401 || res.status === 403 || res.status === 404,
      `${method} ${path} answered ${res.status} to a door token`);
  }
});

test('a door token cannot read the admin summary even with a key-shaped query', async () => {
  const res = await fetch(API + '/api/admin/summary?key=' + encodeURIComponent(token));
  assert.equal(res.status, 401, 'a scanner token must not work as an admin key');
});

test('the door token only unlocks verify, redeem and me', async () => {
  for (const [path, method, expected] of [
    ['/api/staff/me','GET',200],
    ['/api/staff/verify','POST',400],   // reachable, rejects an empty code
    ['/api/staff/redeem','POST',400]
  ]) {
    const res = await asScanner(path, method);
    assert.equal(res.status, expected, `${method} ${path}`);
  }
});

test('the wallet endpoint needs an access token a bouncer never sees', async () => {
  // A door device knows a reference. Without the per-ticket accessToken that
  // is only ever sent to the buyer, it returns nothing.
  const res = await fetch(API + '/api/tickets/wallet', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ tickets:[{ reference:'ISKRA-ANY', accessToken:'' }] })
  });
  const body = await res.json();
  assert.deepEqual(body.tickets, [], 'a reference alone must not return ticket data');
});

test('door responses carry no buyer contact or payment data', async () => {
  const res = await asScanner('/api/staff/me');
  const body = await res.json();
  const serialised = JSON.stringify(body);
  for (const leak of ['email','price','stripe','order','accessToken','qrSecret'])
    assert.equal(serialised.toLowerCase().includes(leak.toLowerCase()), false, `${leak} leaked from /staff/me`);
});
