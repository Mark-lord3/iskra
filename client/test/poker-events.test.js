import test from 'node:test';
import assert from 'node:assert/strict';
import { diffTable, sortEvents, fastForward, isTerminal, EVENT_ORDER } from '../src/poker/events.js';

/* Minimal snapshots in the shape the server actually sends. */
const snap = ({ handId='h1', handNumber=1, version=0, street='preflop', board=[], pot=0,
                currentBet=0, buttonSeat=0, actor=1, seats=[], table=null, result=null,
                level=null } = {}) => ({
  tableId:'t1', handNumber, level,
  seats: table || seats.map(s => ({ seatIndex:s.seat, displayName:`P${s.seat}`,
    stack:s.stack ?? 1000, status:s.status || 'active', connected:s.connected !== false })),
  hand: { handId, version, street, board, pot, currentBet, buttonSeat, actor,
          seats: seats.map(s => ({ seat:s.seat, stack:s.stack ?? 1000, committed:s.committed ?? 0,
            folded:!!s.folded, allIn:!!s.allIn, hole:s.hole ?? ['?','?'] })), result, legal:[] }
});

const types = events => events.map(e => e.type);

test('a first snapshot deals rather than replaying nothing', () => {
  const events = diffTable(null, snap({ seats:[{seat:0},{seat:1}] }));
  assert.deepEqual(types(events), ['stage','deal','blinds']);
  assert.equal(events[1].count, 4, 'two cards for each of two players');
});

test('a new hand is announced, dealt and re-buttoned in that order', () => {
  const first = snap({ handId:'h1', handNumber:1, seats:[{seat:0},{seat:1}] });
  const second = snap({ handId:'h2', handNumber:2, buttonSeat:1, seats:[{seat:0},{seat:1}] });
  assert.deepEqual(types(diffTable(first, second)), ['stage','deal','blinds']);
});

test('a bet produces both an announcement and chip movement', () => {
  const before = snap({ seats:[{seat:0},{seat:1}] });
  const after = snap({ version:1, currentBet:100, seats:[{seat:0,committed:100},{seat:1}] });
  const events = diffTable(before, after);
  assert.deepEqual(types(events), ['action','bet']);
  assert.equal(events[0].move, 'bet');
  assert.equal(events[0].amount, 100);
  assert.equal(events[1].amount, 100, 'chips move by the amount actually staked');
});

test('a call is told apart from a raise', () => {
  const before = snap({ currentBet:100, seats:[{seat:0,committed:100},{seat:1}] });
  const call = diffTable(before, snap({ version:1, currentBet:100,
    seats:[{seat:0,committed:100},{seat:1,committed:100}] }));
  assert.equal(call.find(e => e.type === 'action').move, 'call');

  const raise = diffTable(before, snap({ version:1, currentBet:300,
    seats:[{seat:0,committed:100},{seat:1,committed:300}] }));
  assert.equal(raise.find(e => e.type === 'action').move, 'raise');
});

test('an all-in is announced as an all-in, not as a raise', () => {
  const before = snap({ currentBet:100, seats:[{seat:0,committed:100},{seat:1}] });
  const after = snap({ version:1, currentBet:900,
    seats:[{seat:0,committed:100},{seat:1,committed:900,allIn:true,stack:0}] });
  assert.equal(diffTable(before, after).find(e => e.type === 'action').move, 'allIn');
});

test('a fold announces and mucks', () => {
  const before = snap({ seats:[{seat:0},{seat:1}] });
  const after = snap({ version:1, seats:[{seat:0},{seat:1,folded:true}] });
  const events = diffTable(before, after);
  assert.deepEqual(types(events), ['action','fold']);
  assert.equal(events[0].move, 'fold');
});

test('a check is only read when the turn actually passed', () => {
  const before = snap({ actor:1, seats:[{seat:0},{seat:1}] });
  const passed = diffTable(before, snap({ version:1, actor:0, seats:[{seat:0},{seat:1}] }));
  assert.equal(passed.find(e => e.type === 'action')?.move, 'check');

  // Same actor, nothing staked: nothing happened, so nothing is announced.
  const idle = diffTable(before, snap({ version:1, actor:1, seats:[{seat:0},{seat:1}] }));
  assert.equal(idle.length, 0);
});

test('a street change collects the chips before turning the cards', () => {
  const before = snap({ street:'preflop', seats:[{seat:0,committed:100},{seat:1,committed:100}] });
  const after = snap({ version:2, street:'flop', board:[0,4,8], pot:200,
    seats:[{seat:0,committed:0},{seat:1,committed:0}] });
  const events = diffTable(before, after);
  assert.deepEqual(types(events), ['collect','flip']);
  assert.deepEqual(events[1].cards, [0,4,8], 'only the newly exposed cards flip');
  assert.equal(events[1].from, 0);
});

test('the turn flips one card, not the whole board again', () => {
  const before = snap({ street:'flop', board:[0,4,8],
    seats:[{seat:0,committed:50},{seat:1,committed:50}] });
  const after = snap({ version:3, street:'turn', board:[0,4,8,12],
    seats:[{seat:0,committed:0},{seat:1,committed:0}] });
  const flip = diffTable(before, after).find(e => e.type === 'flip');
  assert.deepEqual(flip.cards, [12]);
  assert.equal(flip.from, 3);
});

test('a showdown reveals, then awards', () => {
  const before = snap({ street:'river', board:[0,4,8,12,16], seats:[{seat:0},{seat:1}] });
  const after = snap({ version:9, street:'complete', board:[0,4,8,12,16], pot:400,
    seats:[{seat:0},{seat:1}],
    result:{ uncontested:false,
      showdown:[{seat:0,hole:[20,24],hand:'a pair of jacks'}],
      pots:[{ amount:400, payouts:{ 0:400 } }] } });
  const events = diffTable(before, after);
  assert.ok(types(events).indexOf('showdown') < types(events).indexOf('award'));
  const award = events.find(e => e.type === 'award');
  assert.deepEqual(award.winners, [{ seat:0, amount:400, name:'P0' }]);
  assert.equal(award.split, false);
});

test('a split pot is marked as split and pays both seats', () => {
  const before = snap({ street:'river', board:[0,4,8,12,16], seats:[{seat:0},{seat:1}] });
  const after = snap({ version:9, street:'complete', pot:400, board:[0,4,8,12,16],
    seats:[{seat:0},{seat:1}],
    result:{ uncontested:false, showdown:[{seat:0,hole:[20,24],hand:'a flush'},{seat:1,hole:[28,32],hand:'a flush'}],
      pots:[{ amount:400, payouts:{ 0:200, 1:200 } }] } });
  const award = diffTable(before, after).find(e => e.type === 'award');
  assert.equal(award.split, true);
  assert.equal(award.winners.length, 2);
  assert.deepEqual(award.winners.map(w => w.amount), [200, 200]);
});

test('side pots are awarded from the server figures, not recomputed', () => {
  const before = snap({ street:'river', board:[0,4,8,12,16], seats:[{seat:0},{seat:1},{seat:2}] });
  const after = snap({ version:9, street:'complete', pot:1500, board:[0,4,8,12,16],
    seats:[{seat:0},{seat:1},{seat:2}],
    result:{ uncontested:false, showdown:[], pots:[
      { amount:900, payouts:{ 2:900 } },
      { amount:600, payouts:{ 0:600 } } ] } });
  const award = diffTable(before, after).find(e => e.type === 'award');
  assert.equal(award.pots.length, 2);
  assert.deepEqual(award.winners.map(w => [w.seat, w.amount]).sort(), [[0,600],[2,900]]);
});

test('an uncontested pot still animates to the last player standing', () => {
  const before = snap({ seats:[{seat:0},{seat:1}] });
  const after = snap({ version:2, street:'complete', pot:150,
    seats:[{seat:0},{seat:1,folded:true}],
    result:{ uncontested:true, showdown:[], pots:[] } });
  const award = diffTable(before, after).find(e => e.type === 'award');
  assert.equal(award.uncontested, true);
  assert.deepEqual(award.winners, [{ seat:0, amount:150, name:'P0' }]);
});

test('elimination and reconnection are noticed from the seat list', () => {
  const before = snap({ seats:[{seat:0},{seat:1}] });
  const after = { ...snap({ version:1, seats:[{seat:0},{seat:1}] }) };
  after.seats = [
    { seatIndex:0, displayName:'P0', stack:2000, status:'active', connected:true },
    { seatIndex:1, displayName:'P1', stack:0, status:'eliminated', connected:false }
  ];
  const events = diffTable(before, after);
  assert.ok(events.some(e => e.type === 'eliminate' && e.seat === 1));
  assert.ok(events.some(e => e.type === 'presence' && e.connected === false));
});

test('a blind increase is its own event', () => {
  const before = { ...snap({ seats:[{seat:0}] }), level:{ level:1, smallBlind:25, bigBlind:50 } };
  const after = { ...snap({ version:1, seats:[{seat:0}] }), level:{ level:2, smallBlind:50, bigBlind:100 } };
  const level = diffTable(before, after).find(e => e.type === 'level');
  assert.equal(level.level, 2);
  assert.equal(level.bigBlind, 100);
});

test('events always come back in the declared order', () => {
  const shuffled = [{type:'award'},{type:'deal'},{type:'flip'},{type:'stage'},{type:'action'}];
  const ranks = sortEvents(shuffled).map(e => EVENT_ORDER.indexOf(e.type));
  assert.deepEqual(ranks, [...ranks].sort((a,b) => a - b));
});

test('equal-ranked events keep the order they were produced in', () => {
  const same = [{type:'action',seat:2},{type:'action',seat:0},{type:'action',seat:1}];
  assert.deepEqual(sortEvents(same).map(e => e.seat), [2,0,1]);
});

test('catching up keeps what still matters and drops the rest', () => {
  const backlog = [{type:'action'},{type:'bet'},{type:'collect'},{type:'flip'},
                   {type:'showdown'},{type:'award'},{type:'eliminate'}];
  assert.deepEqual(fastForward(backlog).map(e => e.type), ['showdown','award','eliminate']);
});

test('catching up on nothing terminal still shows the last event', () => {
  assert.deepEqual(fastForward([{type:'action'},{type:'bet'}]).map(e => e.type), ['bet']);
});

test('an unchanged snapshot produces no animation at all', () => {
  const state = snap({ seats:[{seat:0},{seat:1}] });
  assert.deepEqual(diffTable(state, { ...state }), []);
});

test('hidden hole cards never carry a value through the differ', () => {
  const before = snap({ seats:[{seat:0,hole:['?','?']},{seat:1,hole:['?','?']}] });
  const after = snap({ handId:'h2', handNumber:2, seats:[{seat:0,hole:['?','?']},{seat:1,hole:[3,7]}] });
  const json = JSON.stringify(diffTable(before, after));
  // The deal event counts cards; it must not carry the cards themselves.
  const deal = diffTable(before, after).find(e => e.type === 'deal');
  assert.equal(deal.cards, undefined, 'a deal animation needs a count, never the faces');
  assert.ok(!json.includes('"hole"'), 'no hole cards travel inside an animation event');
});
