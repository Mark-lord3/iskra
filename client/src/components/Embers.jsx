import { useEffect, useRef } from 'react';
import { REDUCED } from '../utils.js';

const COL = ['#ff5c1a', '#ff8a4c', '#ff2e8b', '#6e56ff'];

export default function Embers() {
  const ref = useRef(null);

  useEffect(() => {
    const c = ref.current, x = c.getContext('2d');
    let w = 0, h = 0, raf = 0, parts = [];

    const size = () => {
      const r = c.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      c.width = w * dpr; c.height = h * dpr;
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const spawn = () => ({
      x: Math.random() * w, y: h + Math.random() * 120, r: Math.random() * 2.2 + 0.5,
      v: Math.random() * 0.7 + 0.18, drift: (Math.random() - 0.5) * 0.35,
      a: Math.random() * 0.6 + 0.15, c: COL[Math.random() * COL.length | 0],
      t: Math.random() * Math.PI * 2
    });
    const loop = () => {
      x.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.y -= p.v; p.t += 0.02; p.x += p.drift + Math.sin(p.t) * 0.32;
        if (p.y < -20) Object.assign(p, spawn());
        x.globalAlpha = p.a * (p.y / h); x.fillStyle = p.c;
        x.shadowBlur = 10; x.shadowColor = p.c;
        x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fill();
      }
      x.globalAlpha = 1; x.shadowBlur = 0;
      raf = requestAnimationFrame(loop);
    };

    size();
    parts = Array.from({ length: REDUCED ? 24 : 80 }, spawn);
    if (!REDUCED) loop();
    addEventListener('resize', size, { passive: true });
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', size); };
  }, []);

  return <canvas id="embers" ref={ref} aria-hidden="true" />;
}
