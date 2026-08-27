import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultBlindSchedule, levelAt, msUntilNextLevel, planTables, seatPlayers,
         balanceMoves, shouldBreakTable, advancingPlayers } from '../src/poker/structure.js';

const MIN = 60_000;

test('the default ladder only ever raises the blinds', () => {
  const s = defaultBlindSchedule();
  const playing = s.filter(l => !l.isBreak);
  for(let i = 1; i < playing.length; i++){
    assert.ok(playing[i].bigBlind > playing[i-1].bigBlind, `level ${i} must raise`);
    assert.ok(playing[i].smallBlind < playing[i].bigBlind, 'small blind stays below big');
  }
  assert.ok(s.some(l => l.isBreak), 'the ladder includes breaks');
});

test('the live level follows the clock', () => {
  const s = [
    { level:1, smallBlind:25, bigBlind:50, durationMinutes:10 },
    { level:2, smallBlind:50, bigBlind:100, durationMinutes:10 },
    { level:3, smallBlind:75, bigBlind:150, durationMinutes:10 }
  ];
  assert.equal(levelAt(s, 0).level, 1);
  assert.equal(levelAt(s, 9.9 * MIN).level, 1);
  assert.equal(levelAt(s, 10 * MIN).level, 2, 'the boundary belongs to the next level');
  assert.equal(levelAt(s, 25 * MIN).level, 3);
});

test('the last level never expires', () => {
  const s = [{ level:1, smallBlind:25, bigBlind:50, durationMinutes:10 }];
  assert.equal(levelAt(s, 500 * MIN).level, 1);
  assert.equal(msUntilNextLevel(s, 500 * MIN), Infinity);
});

test('the countdown to the next level is exact', () => {
  const s = [{ level:1, durationMinutes:10 }, { level:2, durationMinutes:10 }];
  assert.equal(msUntilNextLevel(s, 4 * MIN), 6 * MIN);
  assert.equal(msUntilNextLevel(s, 12 * MIN), 8 * MIN);
});

test('tables are planned so sizes differ by at most one', () => {
  for(const size of [6, 9]){
    for(let n = 1; n <= 200; n++){
      const plan = planTables(n, size);
      assert.equal(plan.reduce((a, b) => a + b, 0), n, `${n} players must all be seated`);
      assert.ok(Math.max(...plan) <= size, `no table exceeds ${size}`);
      assert.ok(Math.max(...plan) - Math.min(...plan) <= 1, `${n} players: ${plan} is uneven`);
    }
  }
});

test('an empty field plans no tables', () => {
  assert.deepEqual(planTables(0, 9), []);
});

test('seating spreads players evenly and numbers seats from zero', () => {
  const players = Array.from({ length: 14 }, (_, i) => ({ userId:`u${i}` }));
  const tables = seatPlayers(players, 9);
  assert.equal(tables.length, 2);
  assert.deepEqual(tables.map(t => t.seats.length), [7, 7]);
  for(const table of tables)
    assert.deepEqual(table.seats.map(s => s.seatIndex), [...table.seats.keys()]);
  const seated = tables.flatMap(t => t.seats.map(s => s.userId));
  assert.equal(new Set(seated).size, 14, 'every player is seated exactly once');
});

test('balancing moves players from the fullest table to the emptiest', () => {
  const moves = balanceMoves([
    { id:'a', size:9, activeCount:9 },
    { id:'b', size:9, activeCount:5 }
  ]);
  assert.ok(moves.length >= 2);
  assert.ok(moves.every(m => m.from === 'a' && m.to === 'b'));
});

test('balancing stops once tables are within one player', () => {
  assert.deepEqual(balanceMoves([
    { id:'a', size:9, activeCount:6 },
    { id:'b', size:9, activeCount:5 }
  ]), []);
});

test('balancing converges rather than oscillating', () => {
  const tables = [
    { id:'a', size:9, activeCount:9 },
    { id:'b', size:9, activeCount:2 },
    { id:'c', size:9, activeCount:7 }
  ];
  const moves = balanceMoves(tables);
  const after = new Map(tables.map(t => [t.id, t.activeCount]));
  for(const m of moves){ after.set(m.from, after.get(m.from) - 1); after.set(m.to, after.get(m.to) + 1); }
  const counts = [...after.values()];
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `did not converge: ${counts}`);
  assert.equal(counts.reduce((a, b) => a + b, 0), 18, 'players are conserved');
});

test('a table breaks only when the field no longer needs it', () => {
  assert.equal(shouldBreakTable([
    { id:'a', size:9, activeCount:5 }, { id:'b', size:9, activeCount:3 }
  ], 9), 'b', 'eight players fit on one table, so the smaller breaks');

  assert.equal(shouldBreakTable([
    { id:'a', size:9, activeCount:9 }, { id:'b', size:9, activeCount:8 }
  ], 9), null, 'seventeen players still need both tables');
});

test('advancement keeps the top players from each table', () => {
  const tables = [
    { players:[{ userId:'a', stack:5000 }, { userId:'b', stack:1000 }, { userId:'c', stack:0, eliminationOrder:2 }] },
    { players:[{ userId:'d', stack:9000 }, { userId:'e', stack:200 }] }
  ];
  const up = advancingPlayers(tables, { rule:'top_n_per_table', value:1 });
  assert.deepEqual(up.map(p => p.userId).sort(), ['a','d']);
});

test('percentage advancement measures the whole field', () => {
  const tables = [{ players: Array.from({ length: 10 }, (_, i) => ({ userId:`u${i}`, stack:i * 100 })) }];
  const up = advancingPlayers(tables, { rule:'top_percent', value:20 });
  assert.equal(up.length, 2);
  assert.deepEqual(up.map(p => p.userId), ['u9','u8']);
});

test('advancement never returns nobody', () => {
  const tables = [{ players:[{ userId:'a', stack:100 }] }];
  assert.equal(advancingPlayers(tables, { rule:'top_percent', value:1 }).length, 1);
});

test('a tie in chips is broken by surviving longer, then deterministically', () => {
  const tables = [{ players:[
    { userId:'a', stack:0, eliminationOrder:1 },
    { userId:'b', stack:0, eliminationOrder:9 }
  ] }];
  assert.equal(advancingPlayers(tables, { rule:'top_n_per_table', value:1, seed:'s' })[0].userId, 'b');

  const dead = [{ players:[{ userId:'x', stack:0, eliminationOrder:4 }, { userId:'y', stack:0, eliminationOrder:4 }] }];
  const first = advancingPlayers(dead, { rule:'top_n_per_table', value:1, seed:'s' })[0].userId;
  const again = advancingPlayers([{ players: dead[0].players.slice().reverse() }], { rule:'top_n_per_table', value:1, seed:'s' })[0].userId;
  assert.equal(first, again, 'the same seed must give the same answer');
});
