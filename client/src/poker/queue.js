import { durationOf } from './motion.js';
import { fastForward } from './events.js';

/**
 * A deterministic animation queue.
 *
 * Server events arrive whenever the server decides, which is not the pace an
 * animation plays at. The queue holds them in order and plays exactly one at a
 * time, so two actions arriving 20ms apart never animate on top of each other.
 *
 * It is a plain state machine on purpose: no timers live inside it, so its
 * ordering and catch-up behaviour can be tested without waiting in real time.
 */
export const MAX_PENDING = 6;

export const createQueue = () => ({ pending: [], current: null, endsAt: 0, seq: 0 });

/**
 * Add events. If the backlog is already long — a reconnect, a hidden tab, a
 * burst of all-in action — collapse it rather than replaying the whole hand.
 */
export function pushEvents(queue, events, { reduced = false } = {}){
  if(!events.length) return queue;
  let pending = [...queue.pending, ...events.map((event, i) => ({ ...event, seq: queue.seq + i }))];
  let seq = queue.seq + events.length;

  if(pending.length > MAX_PENDING || reduced){
    const collapsed = reduced ? pending : fastForward(pending);
    pending = collapsed;
  }
  return { ...queue, pending, seq };
}

/**
 * Move the queue forward. Returns the queue plus the event that just started,
 * so the caller can fire sound, haptics and announcements exactly once.
 */
export function advanceQueue(queue, now, { reduced = false } = {}){
  if(queue.current && now < queue.endsAt) return { queue, started: null };
  if(!queue.pending.length){
    return queue.current ? { queue: { ...queue, current: null, endsAt: 0 }, started: null }
                         : { queue, started: null };
  }
  const [next, ...rest] = queue.pending;
  const duration = durationOf(next, reduced);
  return {
    queue: { ...queue, pending: rest, current: next, endsAt: now + duration },
    started: next
  };
}

/** True while something is still playing or waiting to play. */
export const queueBusy = queue => Boolean(queue.current) || queue.pending.length > 0;

/** Drop everything, used when the table changes underneath us. */
export const resetQueue = () => createQueue();

/**
 * Skip to the end immediately, keeping only what a player still needs to see.
 * Used when a hidden tab becomes visible again.
 */
export function flushQueue(queue){
  if(!queueBusy(queue)) return queue;
  const remaining = fastForward(queue.pending);
  return { ...queue, pending: remaining, current: null, endsAt: 0 };
}
