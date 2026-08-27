import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n.jsx';

/**
 * Optional transmission ambience. Off by default and never started without a
 * click, so nothing autoplays. The page is complete with this untouched.
 */
export default function AmbienceToggle() {
  const { t } = useI18n();
  const [on, setOn] = useState(false);
  const node = useRef(null);

  const stop = () => {
    if (!node.current) return;
    const { ctx, gain } = node.current;
    gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25);
    setTimeout(() => { try { ctx.close(); } catch { /* already closed */ } }, 700);
    node.current = null;
  };

  useEffect(() => () => stop(), []);

  const toggle = () => {
    if (on) { stop(); setOn(false); return; }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      gain.connect(ctx.destination);

      // Two slightly detuned low tones plus a slow sweep: a carrier hum
      // rather than music. Kept far below the level of any system sound.
      const a = ctx.createOscillator(), bq = ctx.createBiquadFilter(), lfo = ctx.createOscillator(),
            lfoGain = ctx.createGain(), b2 = ctx.createOscillator();
      a.type = 'sine'; a.frequency.value = 74;
      b2.type = 'sine'; b2.frequency.value = 74.6;
      bq.type = 'lowpass'; bq.frequency.value = 380;
      lfo.frequency.value = 0.07; lfoGain.gain.value = 26;
      lfo.connect(lfoGain).connect(bq.frequency);
      a.connect(bq); b2.connect(bq); bq.connect(gain);
      a.start(); b2.start(); lfo.start();
      gain.gain.setTargetAtTime(0.018, ctx.currentTime, 1.2);
      node.current = { ctx, gain };
      setOn(true);
    } catch { setOn(false); }
  };

  return (
    <button type="button" className="nl-sound" onClick={toggle} aria-pressed={on}>
      <span className="nl-sound-icon" aria-hidden="true">{on ? '◉' : '◌'}</span>
      {on ? t('nl.soundOff') : t('nl.soundOn')}
    </button>
  );
}
