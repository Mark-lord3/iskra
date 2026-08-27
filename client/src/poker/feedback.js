import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Sound and haptics.
 *
 * Both are off by default and both are optional: the table is fully playable
 * with neither. Tones are synthesised rather than loaded, so nothing is
 * downloaded and nothing autoplays — the audio context is only created after
 * the player turns sound on, which is itself a gesture.
 */
const STORAGE_KEY = 'iskra_poker_sound';

/* Short, restrained cues. Frequencies in Hz, durations in seconds. */
const CUES = {
  deal:      { tone: 320, time: 0.05, type:'triangle', gain: 0.05 },
  flip:      { tone: 480, time: 0.06, type:'triangle', gain: 0.05 },
  chip:      { tone: 700, time: 0.05, type:'square',   gain: 0.035 },
  turn:      { tone: 620, time: 0.10, type:'sine',     gain: 0.06 },
  timer:     { tone: 880, time: 0.08, type:'sine',     gain: 0.05 },
  win:       { tone: 523, time: 0.18, type:'sine',     gain: 0.07, then: 784 },
  lose:      { tone: 196, time: 0.16, type:'sine',     gain: 0.05 },
  error:     { tone: 150, time: 0.12, type:'sawtooth', gain: 0.04 }
};

export function useSound(){
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'on'; } catch { return false; }
  });
  const context = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off'); } catch {}
    if(!enabled && context.current){ context.current.close?.(); context.current = null; }
  }, [enabled]);

  useEffect(() => () => { context.current?.close?.(); }, []);

  const play = useCallback(name => {
    if(!enabled) return;
    const cue = CUES[name];
    if(!cue) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if(!Ctx) return;
      if(!context.current) context.current = new Ctx();
      const ctx = context.current;
      if(ctx.state === 'suspended') ctx.resume?.();

      const ring = (frequency, at) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = cue.type; osc.frequency.value = frequency;
        // A quick fade stops the click a hard stop would otherwise make.
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(cue.gain, at + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + cue.time);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(at); osc.stop(at + cue.time + 0.02);
      };
      ring(cue.tone, ctx.currentTime);
      if(cue.then) ring(cue.then, ctx.currentTime + cue.time * 0.7);
    } catch { /* sound is decoration; never let it break the table */ }
  }, [enabled]);

  const toggle = useCallback(() => setEnabled(on => !on), []);
  /* A stable object: this is a dependency of the socket effect, and a fresh
     object on every render would tear the connection down and rebuild it. */
  return useMemo(() => ({ enabled, setEnabled, play, toggle }), [enabled, play, toggle]);
}

/**
 * Haptics, where the device offers them. Silently does nothing everywhere
 * else, and is never required to understand what happened.
 */
const PATTERNS = { tap: 8, confirm: [6, 30, 6], reject: [14, 40, 14], win: [8, 40, 8, 40, 18] };

export function useHaptics(enabled = true){
  return useCallback(name => {
    if(!enabled) return;
    try { navigator.vibrate?.(PATTERNS[name] ?? PATTERNS.tap); } catch {}
  }, [enabled]);
}

/** Which cue an animation event should make, if any. */
export function cueFor(event, mySeat){
  if(!event) return null;
  switch(event.type){
    case 'deal':      return 'deal';
    case 'flip':      return 'flip';
    case 'bet':       return 'chip';
    case 'collect':   return 'chip';
    case 'award':     return event.winners?.some(w => w.seat === mySeat) ? 'win' : 'chip';
    case 'eliminate': return event.seat === mySeat ? 'lose' : null;
    case 'level':     return 'turn';
    default:          return null;
  }
}
