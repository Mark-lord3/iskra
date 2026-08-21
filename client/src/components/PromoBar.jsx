import { useEffect, useState } from 'react';
import { REDUCED } from '../utils.js';

const MESSAGES = [
  '⚡ EARLY BIRD — 40% OFF ALL SEPTEMBER NIGHTS · CODE SPARK40',
  '🎮 BEAT THE LEADERBOARD → $10 TICKETS · PLAY FOR TICKETS BELOW',
  '🔥 GROUPS OF 4+ GO FREE BEFORE MIDNIGHT · CODE FOURPLAY',
  '🎧 NEW: RESIDENT SERIES EVERY THURSDAY · STUDENTS €8'
];

export default function PromoBar() {
  const [open, setOpen] = useState(true);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (REDUCED) return;
    const id = setInterval(() => setI(n => (n + 1) % MESSAGES.length), 4200);
    return () => clearInterval(id);
  }, []);

  if (!open) return null;
  return (
    <div className="promobar">
      <div className="wrap">
        <div className="promobar-rot" aria-live="polite">
          {MESSAGES.map((m, n) => (
            <span key={m} className={n === i ? 'on' : ''}>{m}</span>
          ))}
        </div>
        <button className="promobar-x" onClick={() => setOpen(false)} aria-label="Dismiss announcement">×</button>
      </div>
    </div>
  );
}
