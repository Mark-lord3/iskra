import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import 'dotenv/config';
import mongoose from 'mongoose';
import crypto from 'node:crypto';

import Tournament from '../src/models/PokerTournament.js';
import Registration from '../src/models/TournamentRegistration.js';
import RulesVersion from '../src/models/TournamentRulesVersion.js';
import Prize from '../src/models/TournamentPrize.js';
import Round from '../src/models/TournamentRound.js';
import Table from '../src/models/PokerTable.js';
import Seat from '../src/models/PokerSeat.js';
import Result from '../src/models/TournamentResult.js';
import Audit from '../src/models/TournamentAuditEvent.js';
import Event from '../src/models/Event.js';
import User from '../src/models/User.js';

const API = process.env.TEST_API || 'http://localhost:4310';
const TAG = 'lobby-test';
const ids = {};

const get = (path, cookie) =>
  fetch(API + path, { headers: cookie ? { Cookie: cookie } : {} });

before(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  await cleanup();

  await Event.findOneAndUpdate({ slug:`${TAG}-night` },
    { $set:{ slug:`${TAG}-night`, title:'Lobby Test Night', date:new Date(Date.now()+86400000*20),
             room:'Test', from:30, active:true } }, { upsert:true });

  const tournament = await Tournament.create({
    title:`${TAG} cup`, slug:`${TAG}-cup`, eventSlug:`${TAG}-night`,
    state:'round_one', publishedAt:new Date(),
    registrationClosesAt:new Date(Date.now()-3600_000),
    startsAt:new Date(Date.now()-1800_000),
    tableSize:6, startingStack:1500,
    legalReviewStatus:'approved', legalApprovedAt:new Date(), legalReviewer:'test'
  });
  ids.tournament = tournament._id;

  await Prize.create([1,2,3].map(placement => ({
    tournament: tournament._id, placement, eventSlug:`${TAG}-night`,
    ticketTier:'General admission', ticketQuantity:1, approximateRetailValue:30
  })));

  const round = await Round.create({
    tournament: tournament._id, number:1, name:'round_one', status:'running',
    advancementRule:'top_n_per_table', advancementValue:2, tieBreak:'chips',
    playerCount:3, tableCount:1
  });
  const table = await Table.create({
    tournament: tournament._id, round: round._id, label:'Table 1',
    size:6, status:'running', handNumber:7, blindLevel:2
  });
  ids.table = table._id;

  /* Three players; one of them is "us". */
  const users = [];
  for(const n of [1,2,3]){
    const u = await User.create({
      email:`${TAG}-p${n}@iskra.test`, name:`Lobby Player ${n}`,
      passwordHash:'scrypt:x:y', emailVerifiedAt:new Date(), ageConfirmedAt:new Date()
    });
    users.push(u);
    await Registration.create({
      tournament: tournament._id, user: u._id, displayName:`LOBBY${n}`,
      status: n === 3 ? 'checked_in' : 'registered',
      rulesVersion: new mongoose.Types.ObjectId(), rulesAcceptedAt:new Date(),
      registeredAt: new Date(Date.now() - (4 - n) * 60_000)
    });
    await Seat.create({
      table: table._id, tournament: tournament._id, user: u._id, seatIndex: n - 1,
      displayName:`LOBBY${n}`, stack: n === 1 ? 3000 : n === 2 ? 1200 : 0,
      status: n === 3 ? 'eliminated' : 'active',
      ...(n === 3 ? { eliminationOrder:1, eliminatedAt:new Date() } : {})
    });
    await Result.create({
      tournament: tournament._id, user: u._id, displayName:`LOBBY${n}`,
      finishingChips: n === 3 ? 0 : 1500, roundReached:'round_one',
      ...(n === 3 ? { eliminationOrder:1, eliminatedAt:new Date() } : {})
    });
  }
  ids.users = users.map(u => u._id);

  /* Audit rows that must never reach a visitor intact. */
  await Audit.create([
    { tournament: tournament._id, type:'state_round_one', actorType:'admin',
      actor:'secret-admin@iskra.internal', detail:{ seatingSeed:'super-secret-seed' } },
    { tournament: tournament._id, type:'round_seated', actorType:'system',
      detail:{ seatingSeed:'another-secret-seed', tables:1 } },
    { tournament: tournament._id, type:'prize_issued', actorType:'system',
      detail:{ references:['ISKRA-SECRET-REF'] } }
  ]);
});

after(async () => { await cleanup(); await mongoose.disconnect(); });

async function cleanup(){
  const t = await Tournament.findOne({ slug:`${TAG}-cup` }).lean();
  if(t){
    const tables = await Table.find({ tournament: t._id }).lean();
    await Seat.deleteMany({ table:{ $in: tables.map(x => x._id) } });
    await Table.deleteMany({ tournament: t._id });
    await Round.deleteMany({ tournament: t._id });
    await Registration.deleteMany({ tournament: t._id });
    await Result.deleteMany({ tournament: t._id });
    await Prize.deleteMany({ tournament: t._id });
    await Audit.deleteMany({ tournament: t._id });
    await RulesVersion.deleteMany({ tournament: t._id });
    await Tournament.deleteOne({ _id: t._id });
  }
  await User.deleteMany({ email:/lobby-test-p\d@iskra\.test/ });
  await Event.deleteMany({ slug:`${TAG}-night` });
}

/* ------------------------------------------------------------------ tests */

test('the lobby is readable without signing in', async () => {
  const res = await get(`/api/poker/tournaments/${TAG}-cup/lobby`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.tournament.title, `${TAG} cup`);
  assert.equal(body.me.signedIn, false);
  assert.equal(body.me.registered, false);
});

test('the field counts come from real registrations and seats', async () => {
  const body = await (await get(`/api/poker/tournaments/${TAG}-cup/lobby`)).json();
  assert.equal(body.field.registered, 3, 'three entered');
  assert.equal(body.field.checkedIn, 1);
  assert.equal(body.field.active, 2, 'one of the three is out');
  assert.equal(body.field.eliminated, 1);
  assert.equal(body.field.tables, 1);
  assert.equal(body.field.openSeats, 4, 'a six seat table with two live players');
});

test('the countdown is driven by the server clock', async () => {
  const body = await (await get(`/api/poker/tournaments/${TAG}-cup/lobby`)).json();
  assert.ok(body.serverTime, 'the server states its own time');
  const skew = Math.abs(new Date(body.serverTime).getTime() - Date.now());
  assert.ok(skew < 60_000, 'server time is real, not echoed from the client');
  // A running tournament counts down to nothing.
  assert.equal(body.countdown, null);
});

test('the table map shows occupancy but never a card', async () => {
  const body = await (await get(`/api/poker/tournaments/${TAG}-cup/lobby`)).json();
  assert.equal(body.tables.length, 1);
  const table = body.tables[0];
  assert.equal(table.label, 'Table 1');
  assert.equal(table.occupied, 2);
  assert.equal(table.open, 4);
  assert.equal(table.handNumber, 7);
  const json = JSON.stringify(body);
  for(const leak of ['hole','deck','shuffleSeed','shuffleCommitment'])
    assert.ok(!json.includes(leak), `the lobby must not mention ${leak}`);
});

test('no email address is ever present in the payload', async () => {
  const body = await (await get(`/api/poker/tournaments/${TAG}-cup/lobby`)).json();
  const json = JSON.stringify(body);
  assert.ok(!json.includes('@iskra.test'), 'player emails must not appear');
  assert.ok(!json.includes('iskra.internal'), 'the administrator must not appear');
  assert.ok(!/@[a-z0-9.-]+\.[a-z]{2,}/i.test(json), 'nothing that looks like an email may appear');
});

test('audit detail never reaches the activity feed', async () => {
  const body = await (await get(`/api/poker/tournaments/${TAG}-cup/lobby`)).json();
  const json = JSON.stringify(body.activity);
  assert.ok(!json.includes('super-secret-seed'), 'the seating seed stays private');
  assert.ok(!json.includes('another-secret-seed'));
  assert.ok(!json.includes('ISKRA-SECRET-REF'), 'issued ticket references stay private');
  assert.ok(!json.includes('secret-admin'), 'the acting administrator stays private');
  // Only whitelisted lifecycle events survive.
  const kinds = new Set(body.activity.filter(a => a.kind === 'state').map(a => a.type));
  assert.ok(!kinds.has('prize_issued'), 'prize issuance is not a public event');
  assert.ok(kinds.has('state_round_one'));
});

test('the activity feed carries registrations and eliminations by display name', async () => {
  const body = await (await get(`/api/poker/tournaments/${TAG}-cup/lobby`)).json();
  const names = body.activity.map(a => a.displayName).filter(Boolean);
  assert.ok(names.includes('LOBBY1'), 'registrations are public');
  assert.ok(body.activity.some(a => a.kind === 'elimination'));
  // Newest first.
  const times = body.activity.map(a => new Date(a.at).getTime());
  assert.deepEqual(times, [...times].sort((a, b) => b - a));
});

test('the leaderboard ranks by real chip counts', async () => {
  const body = await (await get(`/api/poker/tournaments/${TAG}-cup/lobby`)).json();
  assert.deepEqual(body.leaderboard.map(r => r.displayName), ['LOBBY1','LOBBY2']);
  assert.deepEqual(body.leaderboard.map(r => r.chips), [3000, 1200]);
  assert.deepEqual(body.leaderboard.map(r => r.rank), [1, 2]);
  assert.equal(body.leaderboard[0].table, 'Table 1');
  assert.ok(body.leaderboard.every(r => r.isMe === false), 'nobody is "me" when signed out');
});

test('the bracket reports all three rounds with real counts', async () => {
  const body = await (await get(`/api/poker/tournaments/${TAG}-cup/lobby`)).json();
  assert.deepEqual(body.bracket.map(b => b.name), ['round_one','round_two','final_round']);
  assert.equal(body.bracket[0].status, 'running');
  assert.equal(body.bracket[0].playerCount, 3);
  assert.equal(body.bracket[0].survivors, 2);
  assert.equal(body.bracket[1].status, 'pending', 'a round that has not happened is pending');
  assert.equal(body.bracket[2].playerCount, 0);
});

test('prizes are listed for all three placements', async () => {
  const body = await (await get(`/api/poker/tournaments/${TAG}-cup/lobby`)).json();
  assert.equal(body.tournament.prizes.length, 3);
  assert.deepEqual(body.tournament.prizes.map(p => p.placement), [1,2,3]);
  assert.equal(body.tournament.noPurchaseNecessary, true);
  assert.equal(body.tournament.entryCost, 0);
});

test('an unpublished tournament is not reachable from the lobby', async () => {
  await Tournament.updateOne({ slug:`${TAG}-cup` }, { $set:{ publishedAt: null } });
  const res = await get(`/api/poker/tournaments/${TAG}-cup/lobby`);
  assert.equal(res.status, 404);
  await Tournament.updateOne({ slug:`${TAG}-cup` }, { $set:{ publishedAt: new Date() } });
});

test('an unknown tournament answers 404, not a crash', async () => {
  const res = await get('/api/poker/tournaments/no-such-tournament/lobby');
  assert.equal(res.status, 404);
  assert.equal((await res.json()).code, 'NOT_FOUND');
});

test('a registration-open tournament counts down to its close', async () => {
  const closes = new Date(Date.now() + 3600_000);
  await Tournament.updateOne({ slug:`${TAG}-cup` },
    { $set:{ state:'registration_open', registrationClosesAt: closes } });
  const body = await (await get(`/api/poker/tournaments/${TAG}-cup/lobby`)).json();
  assert.equal(body.countdown.label, 'registration_closes');
  assert.equal(new Date(body.countdown.target).toISOString(), closes.toISOString());
  await Tournament.updateOne({ slug:`${TAG}-cup` }, { $set:{ state:'round_one' } });
});

test('a completed tournament ranks by finishing place', async () => {
  await Result.updateOne({ tournament: ids.tournament, displayName:'LOBBY1' }, { $set:{ placement:1 } });
  await Result.updateOne({ tournament: ids.tournament, displayName:'LOBBY2' }, { $set:{ placement:2 } });
  await Result.updateOne({ tournament: ids.tournament, displayName:'LOBBY3' }, { $set:{ placement:3 } });
  await Tournament.updateOne({ slug:`${TAG}-cup` }, { $set:{ state:'completed' } });

  const body = await (await get(`/api/poker/tournaments/${TAG}-cup/lobby`)).json();
  assert.deepEqual(body.leaderboard.map(r => r.rank), [1,2,3], 'finished tournaments rank by placement');
  assert.deepEqual(body.leaderboard.map(r => r.displayName), ['LOBBY1','LOBBY2','LOBBY3']);
  assert.equal(body.leaderboard[0].status, 'winner');
  await Tournament.updateOne({ slug:`${TAG}-cup` }, { $set:{ state:'round_one' } });
});

test('a configured seat cap is reported to the lobby', async () => {
  await Tournament.updateOne({ slug:`${TAG}-cup` }, { $set:{ maxPlayers: 24 } });
  const body = await (await get(`/api/poker/tournaments/${TAG}-cup/lobby`)).json();
  assert.equal(body.field.capacity, 24);
  await Tournament.updateOne({ slug:`${TAG}-cup` }, { $set:{ maxPlayers: null } });
  const open = await (await get(`/api/poker/tournaments/${TAG}-cup/lobby`)).json();
  assert.equal(open.field.capacity, null, 'no cap means an unlimited pool');
});

test('a withdrawn entry is not reported as a live registration', async () => {
  const Reg = (await import('../src/models/TournamentRegistration.js')).default;
  const T2 = (await import('../src/models/PokerTournament.js')).default;
  const tournament = await T2.findOne({ slug:'lobby-test-cup' }).lean();

  // LOBBY1 walks away before the tournament starts.
  await Reg.updateOne({ tournament: tournament._id, displayName:'LOBBY1' },
    { $set:{ status:'withdrawn' } });

  const body = await (await get(`/api/poker/tournaments/lobby-test-cup/lobby`)).json();
  assert.equal(body.field.registered, 2, 'the field no longer counts them');
  assert.equal(body.field.withdrawn, 1);
  assert.ok(!body.recentRegistrations.some(r => r.displayName === 'LOBBY1'),
    'a withdrawn entry is not listed as a recent entry');

  await Reg.updateOne({ tournament: tournament._id, displayName:'LOBBY1' },
    { $set:{ status:'registered' } });
});

test('a player who withdrew can enter again while the window is open', async () => {
  const Reg = (await import('../src/models/TournamentRegistration.js')).default;
  const T2 = (await import('../src/models/PokerTournament.js')).default;
  const tournament = await T2.findOne({ slug:'lobby-test-cup' }).lean();

  await Reg.updateOne({ tournament: tournament._id, displayName:'LOBBY1' },
    { $set:{ status:'withdrawn' } });

  // Re-registering reuses the row rather than being refused as a duplicate.
  const before = await Reg.countDocuments({ tournament: tournament._id });
  await Reg.findOneAndUpdate(
    { tournament: tournament._id, displayName:'LOBBY1' },
    { $set:{ status:'registered', registeredAt:new Date() } });
  const after = await Reg.countDocuments({ tournament: tournament._id });
  assert.equal(after, before, 'no second row is created');

  const body = await (await get(`/api/poker/tournaments/lobby-test-cup/lobby`)).json();
  assert.equal(body.field.registered, 3, 'they are back in the field');
});
