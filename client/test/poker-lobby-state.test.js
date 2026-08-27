import test from 'node:test';
import assert from 'node:assert/strict';
import { clockOffset, serverNow, remaining, countdownParts, pad2,
         lobbyStatus, primaryAction, capacityMeter, featuredTournament } from '../src/poker/lobby.js';

const T = (state, extra = {}) => ({ state, slug:'cup', ...extra });

/* ------------------------------------------------------- the server clock */

test('the countdown follows the server, not the device', () => {
  // A device running four hours fast still sees the true remaining time.
  const serverTime = '2026-01-01T12:00:00.000Z';
  const deviceNow = Date.parse('2026-01-01T16:00:00.000Z');
  const offset = clockOffset(serverTime, deviceNow);
  assert.equal(offset, -4 * 3600_000);
  assert.equal(serverNow(offset, deviceNow), Date.parse(serverTime));

  const target = '2026-01-01T12:30:00.000Z';
  assert.equal(remaining(target, offset, deviceNow), 30 * 60_000);
});

test('a countdown never runs negative', () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  assert.equal(remaining(past), 0);
});

test('a missing or unparseable target has no countdown', () => {
  assert.equal(remaining(null), null);
  assert.equal(remaining('not a date'), null);
  assert.equal(clockOffset(null), 0);
  assert.equal(clockOffset('nonsense'), 0);
});

test('a duration splits into the digits shown', () => {
  assert.deepEqual(countdownParts(90_061_000),
    { days:1, hours:1, minutes:1, seconds:1, totalSeconds:90061 });
  assert.deepEqual(countdownParts(0), { days:0, hours:0, minutes:0, seconds:0, totalSeconds:0 });
  assert.deepEqual(countdownParts(null), { days:0, hours:0, minutes:0, seconds:0, totalSeconds:0 });
  assert.equal(pad2(7), '07');
});

/* ------------------------------------------------------------- the status */

test('every tournament state maps to a status the hero can announce', () => {
  const cases = {
    scheduled:'scheduled', registration_locked:'starting_soon',
    round_one:'live', round_two:'live', final_round:'live',
    paused:'paused', completed:'completed', cancelled:'cancelled', voided:'cancelled'
  };
  for(const [state, key] of Object.entries(cases))
    assert.equal(lobbyStatus(T(state)).key, key, state);
});

test('registration open becomes "closing" inside the last quarter hour', () => {
  const now = Date.parse('2026-01-01T12:00:00.000Z');
  const open = { target:'2026-01-01T13:00:00.000Z' };
  const soon = { target:'2026-01-01T12:10:00.000Z' };
  assert.equal(lobbyStatus(T('registration_open'), open, 0, now).key, 'registration_open');
  assert.equal(lobbyStatus(T('registration_open'), soon, 0, now).key, 'closing_soon');
});

test('an unknown or missing tournament is not announced as live', () => {
  assert.equal(lobbyStatus(null).key, 'unavailable');
  assert.equal(lobbyStatus(T('draft')).key, 'unavailable');
  assert.equal(lobbyStatus(T('draft')).tone, 'off');
});

/* ------------------------------------------------------- the one action */

test('a signed-out visitor is sent to sign in, not to a dead link', () => {
  const action = primaryAction({ signedIn:false }, T('registration_open'));
  assert.equal(action.key, 'sign_in');
  assert.equal(action.href, '/account');
  assert.notEqual(action.href, '#');
});

test('a signed-in visitor who has not entered is offered registration', () => {
  const action = primaryAction({ signedIn:true, registered:false }, T('registration_open'));
  assert.deepEqual(action, { key:'register', kind:'action', action:'register' });
});

test('a full tournament offers no registration button', () => {
  const action = primaryAction({ signedIn:true, registered:false }, T('registration_open',{ full:true }));
  assert.equal(action.key, 'full');
  assert.equal(action.disabled, true);
  assert.equal(action.kind, 'none');
});

test('a registered player is offered check-in, then nothing more', () => {
  const registered = { signedIn:true, registered:true, status:'registered' };
  assert.equal(primaryAction(registered, T('registration_open')).action, 'check-in');
  const checked = { ...registered, status:'checked_in' };
  assert.equal(primaryAction(checked, T('registration_open')).key, 'registered');
  assert.equal(primaryAction(checked, T('registration_open')).disabled, true);
});

test('a seated player is sent to their table only when the server allows it', () => {
  const seated = { signedIn:true, registered:true, canOpenTable:true,
                   seat:{ status:'active', tableId:'t1' } };
  const action = primaryAction(seated, T('round_one'));
  assert.equal(action.key, 'join_table');
  assert.equal(action.href, '/play/poker/cup/table');

  // The same player with the server withholding permission gets no table link.
  const held = { ...seated, canOpenTable:false };
  assert.equal(primaryAction(held, T('round_one')).key, 'registered');
});

test('a disconnected player resumes rather than joins', () => {
  const away = { signedIn:true, registered:true, canOpenTable:true,
                 seat:{ status:'disconnected', tableId:'t1' } };
  assert.equal(primaryAction(away, T('round_one')).key, 'resume_table');
});

test('a player knocked out of a running tournament is told so', () => {
  const out = { signedIn:true, registered:true, canOpenTable:false, seat:null };
  const action = primaryAction(out, T('round_one'));
  assert.equal(action.key, 'eliminated');
  assert.equal(action.disabled, true);
});

test('a finished tournament points everyone at the results', () => {
  for(const me of [{ signedIn:false }, { signedIn:true, registered:true }]){
    const action = primaryAction(me, T('completed'));
    assert.equal(action.key, 'view_results');
    assert.equal(action.href, '/play/poker/cup/results');
  }
});

test('a cancelled tournament offers no action at all', () => {
  const action = primaryAction({ signedIn:true, registered:true }, T('cancelled'));
  assert.equal(action.disabled, true);
  assert.equal(action.kind, 'none');
});

test('no action ever produces a placeholder link', () => {
  const states = ['scheduled','registration_open','registration_locked','round_one',
                  'round_two','final_round','paused','completed','cancelled'];
  const people = [
    { signedIn:false },
    { signedIn:true, registered:false },
    { signedIn:true, registered:true, status:'registered' },
    { signedIn:true, registered:true, status:'checked_in', canOpenTable:true, seat:{ status:'active' } }
  ];
  for(const state of states)
    for(const me of people){
      const action = primaryAction(me, T(state));
      if(action.kind === 'link') assert.ok(action.href && action.href !== '#', `${state}: ${action.href}`);
      if(action.kind === 'action') assert.ok(action.action, `${state} needs a real action`);
    }
});

/* ------------------------------------------------------------- the meter */

test('a capped field measures against its cap', () => {
  assert.deepEqual(capacityMeter({ registered:12, capacity:24 }),
    { registered:12, capacity:24, percent:50, capped:true });
  // Over-subscription never draws past full.
  assert.equal(capacityMeter({ registered:30, capacity:24 }).percent, 100);
});

test('an uncapped field still shows progress and says it is uncapped', () => {
  const meter = capacityMeter({ registered:5, capacity:null, tables:1 });
  assert.equal(meter.capped, false);
  assert.equal(meter.capacity, null);
  assert.ok(meter.percent > 0 && meter.percent <= 100);
});

test('an empty field is drawn at zero rather than dividing by zero', () => {
  const meter = capacityMeter({ registered:0, capacity:null, tables:0 });
  assert.equal(meter.percent, 0);
  assert.ok(Number.isFinite(meter.percent));
});

/* ----------------------------------------------------------- the feature */

test('the lobby leads with the tournament a visitor can act on', () => {
  const list = [
    { slug:'done', state:'completed', startsAt:'2026-01-01' },
    { slug:'later', state:'scheduled', startsAt:'2026-03-01' },
    { slug:'open', state:'registration_open', startsAt:'2026-02-01' },
    { slug:'running', state:'round_one', startsAt:'2026-01-15' }
  ];
  assert.equal(featuredTournament(list).slug, 'open');
  assert.equal(featuredTournament(list.filter(t => t.state !== 'registration_open')).slug, 'running');
  assert.equal(featuredTournament([]), null);
});
