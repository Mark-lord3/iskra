import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { diffTable } from './events.js';
import { createQueue, pushEvents, advanceQueue, flushQueue, queueBusy } from './queue.js';
import { reconcile, isBigJump } from './reconcile.js';
import { createPending, beginAction, settleAction, timeoutAction } from './pending.js';
import { useReducedMotion, usePageVisible } from './motion.js';
import { useSound, useHaptics, cueFor } from './feedback.js';

/**
 * The live table connection.
 *
 * The socket is the fast path and the REST snapshot is the recovery path.
 * Whichever arrives, it is ranked before it is accepted, so a late message can
 * never rewind the table. Animations are derived from the difference between
 * accepted snapshots and played through a queue, one at a time.
 *
 * The rendered numbers always come from the authoritative snapshot. Animation
 * never holds a shadow copy of the game state, so it cannot drift out of step
 * with the server.
 */
const RETRY_MS = [1000, 2000, 4000, 8000, 15000];
const ACTION_TIMEOUT_MS = 12000;

export function useTableStream({ tableId, enabled = true, fetchSnapshot, sendAction, socketUrl }){
  const [state, setState] = useState(null);
  const [connection, setConnection] = useState('idle');   // idle|connecting|live|reconnecting|error
  const [event, setEvent] = useState(null);               // the animation playing right now
  const [announcements, setAnnouncements] = useState([]);
  const [pending, setPending] = useState(createPending);
  const [error, setError] = useState('');

  const reduced = useReducedMotion();
  const visible = usePageVisible();
  const sound = useSound();
  const haptic = useHaptics();

  const stateRef = useRef(null);
  const queueRef = useRef(createQueue());
  /* Effects below must not re-run when these change identity, or the socket
     would be torn down and rebuilt on every render. */
  const soundRef = useRef(sound); soundRef.current = sound;
  const hapticRef = useRef(haptic); hapticRef.current = haptic;
  const acceptRef = useRef(null);
  const snapshotRef = useRef(fetchSnapshot); snapshotRef.current = fetchSnapshot;
  const socketRef = useRef(null);
  const attemptRef = useRef(0);
  const closedRef = useRef(false);
  const frameRef = useRef(0);

  /* ------------------------------------------------- accepting a snapshot */

  const accept = useCallback(incoming => {
    const current = stateRef.current;
    const { state: next, changed } = reconcile(current, incoming);
    if(!changed) return;

    // A wide gap means we were away. Show the outcome, not the whole hand.
    const jumped = isBigJump(current, next);
    const events = diffTable(current, next);
    stateRef.current = next;
    setState(next);

    if(events.length){
      queueRef.current = pushEvents(queueRef.current, events, { reduced });
      if(jumped) queueRef.current = flushQueue(queueRef.current);
    }
  }, [reduced]);
  acceptRef.current = accept;

  /* ---------------------------------------------------------- the socket */

  useEffect(() => {
    if(!enabled || !tableId || !socketUrl) return;
    closedRef.current = false;
    let retryTimer = null;

    const open = () => {
      if(closedRef.current) return;
      setConnection(attemptRef.current === 0 ? 'connecting' : 'reconnecting');
      let socket;
      try { socket = new WebSocket(socketUrl(tableId)); }
      catch { return schedule(); }
      socketRef.current = socket;

      socket.onopen = () => {
        attemptRef.current = 0;
        setConnection('live');
        // Ask for a fresh snapshot rather than assuming nothing moved.
        try { socket.send(JSON.stringify({ type:'sync' })); } catch {}
      };
      socket.onmessage = message => {
        let payload;
        try { payload = JSON.parse(message.data); } catch { return; }
        if(payload.state) acceptRef.current(payload.state);
        if(payload.event === 'rejected'){
          setError(payload.code || 'Action rejected.');
          soundRef.current.play('error');
          hapticRef.current('reject');
          setPending(current => current.inFlight
            ? settleAction(current, current.inFlight.actionId, { ok:false, code: payload.code })
            : current);
        }
      };
      socket.onclose = () => { socketRef.current = null; schedule(); };
      socket.onerror = () => { try { socket.close(); } catch {} };
    };

    /* Reconnect with a widening gap so a server restart is not stampeded. */
    const schedule = () => {
      if(closedRef.current) return;
      setConnection('reconnecting');
      const wait = RETRY_MS[Math.min(attemptRef.current, RETRY_MS.length - 1)];
      attemptRef.current += 1;
      retryTimer = setTimeout(open, wait);
      // While the socket is down the REST snapshot keeps the table truthful.
      snapshotRef.current?.().then(s => acceptRef.current(s)).catch(() => {});
    };

    open();
    return () => {
      closedRef.current = true;
      clearTimeout(retryTimer);
      try { socketRef.current?.close(); } catch {}
      socketRef.current = null;
    };
  }, [tableId, enabled, socketUrl]);

  /* ------------------------------------------------ the REST safety net */

  useEffect(() => {
    if(!enabled || !fetchSnapshot) return;
    let cancelled = false;
    const poll = () => {
      // Only while the socket is not carrying updates, and never in a hidden tab.
      if(cancelled || connection === 'live' || !visible) return;
      snapshotRef.current().then(snapshot => { if(!cancelled) acceptRef.current(snapshot); }).catch(() => {});
    };
    poll();
    const timer = setInterval(poll, 4000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [enabled, connection, visible]);

  /* -------------------------------------------------- playing the queue */

  useEffect(() => {
    let running = true;
    const step = () => {
      if(!running) return;
      const { queue, started } = advanceQueue(queueRef.current, performance.now(), { reduced });
      queueRef.current = queue;
      if(started){
        setEvent(started);
        const cue = cueFor(started, stateRef.current?.mySeat);
        if(cue) soundRef.current.play(cue);
        if(started.type === 'award' && started.winners?.some(w => w.seat === stateRef.current?.mySeat))
          hapticRef.current('win');
        if(started.type === 'action' || started.type === 'level' || started.type === 'eliminate')
          setAnnouncements(list => [...list.slice(-4), { ...started, id: started.seq }]);
      } else if(!queueBusy(queue)){
        setEvent(current => current ? null : current);
      }
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => { running = false; cancelAnimationFrame(frameRef.current); };
  }, [reduced]);

  /* A tab that comes back does not replay what it missed. */
  useEffect(() => {
    if(visible) queueRef.current = flushQueue(queueRef.current);
  }, [visible]);

  /* ------------------------------------------------------------- acting */

  const send = useCallback(async move => {
    const start = beginAction(pending, move);
    if(!start.allowed) return { ok:false, code:'IN_FLIGHT' };
    setPending(start.pending);
    setError('');
    haptic('tap');

    const guard = setTimeout(() => {
      setPending(current => timeoutAction(current, start.action.actionId));
      setError('The table did not answer. Your action was not sent twice.');
    }, ACTION_TIMEOUT_MS);

    try {
      const outcome = await sendAction({ ...start.action, version: stateRef.current?.hand?.version });
      clearTimeout(guard);
      setPending(current => settleAction(current, start.action.actionId, { ok:true }));
      haptic('confirm');
      if(outcome?.state) accept(outcome.state);
      return { ok:true };
    } catch(err){
      clearTimeout(guard);
      setPending(current => settleAction(current, start.action.actionId,
        { ok:false, code: err?.code || 'FAILED' }));
      setError(err?.message || 'That action could not be sent.');
      sound.play('error');
      haptic('reject');
      return { ok:false, code: err?.code };
    }
  }, [pending, sendAction, accept, haptic, sound]);

  const dismissError = useCallback(() => setError(''), []);

  return { state, connection, event, announcements, pending, error, dismissError,
           send, reduced, sound, accept };
}

/**
 * The same animation pipeline for a table whose state is fetched rather than
 * streamed — the practice table. It takes snapshots the caller already has and
 * produces the identical event sequence, so demo play and tournament play look
 * and behave the same.
 */
export function useLocalStream(state){
  const [event, setEvent] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  const sound = useSound();
  const haptic = useHaptics();

  const soundRef = useRef(sound); soundRef.current = sound;
  const previous = useRef(null);
  const queueRef = useRef(createQueue());
  const frameRef = useRef(0);

  useEffect(() => {
    if(!state) return;
    const events = diffTable(previous.current, state);
    previous.current = state;
    if(events.length) queueRef.current = pushEvents(queueRef.current, events, { reduced });
  }, [state, reduced]);

  useEffect(() => { if(visible) queueRef.current = flushQueue(queueRef.current); }, [visible]);

  useEffect(() => {
    let running = true;
    const step = () => {
      if(!running) return;
      const { queue, started } = advanceQueue(queueRef.current, performance.now(), { reduced });
      queueRef.current = queue;
      if(started){
        setEvent(started);
        const cue = cueFor(started, previous.current?.mySeat ?? 0);
        if(cue) soundRef.current.play(cue);
        if(started.type === 'action' || started.type === 'level' || started.type === 'eliminate')
          setAnnouncements(list => [...list.slice(-4), { ...started, id: started.seq }]);
      } else if(!queueBusy(queue)) setEvent(current => current ? null : current);
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => { running = false; cancelAnimationFrame(frameRef.current); };
  }, [reduced]);

  return { event, announcements, reduced, sound };
}
