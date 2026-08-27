import test from 'node:test';
import assert from 'node:assert/strict';
import { createQueue, pushEvents, advanceQueue, queueBusy, flushQueue, MAX_PENDING } from '../src/poker/queue.js';
import { durationOf, MOTION } from '../src/poker/motion.js';

const drain = (queue, { reduced = false, from = 0 } = {}) => {
  const played = [];
  let now = from, guard = 0;
  while(queueBusy(queue) && guard++ < 200){
    const step = advanceQueue(queue, now, { reduced });
    queue = step.queue;
    if(step.started) played.push(step.started);
    now = queue.endsAt || now + 1;
  }
  return { queue, played };
};

test('events play one at a time, in the order they were queued', () => {
  let queue = pushEvents(createQueue(), [
    { type:'action', move:'bet' }, { type:'bet' }, { type:'collect' }
  ]);
  const { played } = drain(queue);
  assert.deepEqual(played.map(e => e.type), ['action','bet','collect']);
});

test('a second event does not start while the first is still playing', () => {
  let queue = pushEvents(createQueue(), [{ type:'flip' }, { type:'award' }]);
  const first = advanceQueue(queue, 0);
  assert.equal(first.started.type, 'flip');

  const tooSoon = advanceQueue(first.queue, MOTION.flip.duration - 1);
  assert.equal(tooSoon.started, null, 'nothing may start mid-animation');

  const onTime = advanceQueue(first.queue, MOTION.flip.duration);
  assert.equal(onTime.started.type, 'award');
});

test('each event is held for its own declared duration', () => {
  const queue = pushEvents(createQueue(), [{ type:'award' }]);
  const step = advanceQueue(queue, 1000);
  assert.equal(step.queue.endsAt, 1000 + durationOf({ type:'award' }));
});

test('a burst larger than the backlog limit is collapsed, not replayed', () => {
  const burst = [
    { type:'action' }, { type:'bet' }, { type:'action' }, { type:'bet' },
    { type:'collect' }, { type:'flip' }, { type:'showdown' }, { type:'award' }
  ];
  const queue = pushEvents(createQueue(), burst);
  assert.ok(queue.pending.length <= MAX_PENDING);
  assert.deepEqual(queue.pending.map(e => e.type), ['showdown','award'],
    'only the events a player still needs to see survive');
});

test('reduced motion still delivers every event, with no waiting', () => {
  const events = [{ type:'action', move:'bet' }, { type:'bet' }, { type:'award' }];
  let queue = pushEvents(createQueue(), events, { reduced:true });
  assert.equal(queue.pending.length, 3, 'no event is silently dropped');

  const step = advanceQueue(queue, 500, { reduced:true });
  assert.equal(step.queue.endsAt, 500, 'reduced motion holds nothing');

  const { played } = drain(pushEvents(createQueue(), events, { reduced:true }), { reduced:true });
  assert.deepEqual(played.map(e => e.type), ['action','bet','award']);
});

test('every event type has a real duration, and none under reduced motion', () => {
  for(const type of ['deal','flip','bet','collect','fold','award','showdown','announce','eliminate','stage','celebrate']){
    assert.ok(durationOf({ type, count:2 }) > 0, `${type} must take time`);
    assert.equal(durationOf({ type, count:2 }, true), 0, `${type} must be instant when motion is reduced`);
  }
});

test('an empty queue is not busy and starts nothing', () => {
  const queue = createQueue();
  assert.equal(queueBusy(queue), false);
  assert.equal(advanceQueue(queue, 0).started, null);
});

test('the queue clears itself once the last event finishes', () => {
  let queue = pushEvents(createQueue(), [{ type:'label' }]);
  const started = advanceQueue(queue, 0);
  assert.equal(queueBusy(started.queue), true);
  const done = advanceQueue(started.queue, 99999);
  assert.equal(queueBusy(done.queue), false);
  assert.equal(done.queue.current, null);
});

test('flushing a backlog keeps the outcome and drops the middle', () => {
  let queue = pushEvents(createQueue(), [{ type:'action' }, { type:'bet' }]);
  queue = advanceQueue(queue, 0).queue;
  queue = pushEvents(queue, [{ type:'showdown' }, { type:'award' }]);
  const flushed = flushQueue(queue);
  assert.deepEqual(flushed.pending.map(e => e.type), ['showdown','award']);
  assert.equal(flushed.current, null, 'the in-flight animation is abandoned, not finished');
});

test('flushing an idle queue changes nothing', () => {
  const queue = createQueue();
  assert.deepEqual(flushQueue(queue), queue);
});

test('queued events carry an increasing sequence number', () => {
  let queue = pushEvents(createQueue(), [{ type:'action' }, { type:'bet' }]);
  assert.deepEqual(queue.pending.map(e => e.seq), [0, 1]);
  queue = pushEvents(queue, [{ type:'collect' }]);
  assert.equal(queue.pending[queue.pending.length - 1].seq, 2);
});
