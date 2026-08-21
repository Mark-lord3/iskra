import { useEffect, useRef, useState } from 'react';

export const ROUND = 60;
const lerp = (a, b, t) => a + (b - a) * t;

const EMBER = '#ff5a1f';
const HOT   = '#ffd9c2';   // bonus target, same accent family
const DEAD  = '#43140c';   // penalty target

/**
 * The arcade round. Per-frame state lives in refs so React never re-renders
 * during play. When idle the canvas runs an attract loop, so the stage is
 * never a dead black rectangle behind the sign-up form.
 */
export default function SparkRush({ active, onFinish }) {
  const canvasRef = useRef(null);
  const scoreRef = useRef(null), comboRef = useRef(null), timeRef = useRef(null), barRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const audioRef = useRef(null);

  useEffect(() => { mutedRef.current = muted; }, [muted]);

  useEffect(() => {
    const cv = canvasRef.current, g = cv.getContext('2d');
    let W = 0, H = 0, raf = 0, done = false;

    const fit = () => {
      const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      cv.width = W * dpr; cv.height = H * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(cv);

    /* ---------- shared backdrop ---------- */
    const drawArena = now => {
      const cx = W / 2, cy = H * 0.58;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.75);
      gr.addColorStop(0, 'rgba(255,90,31,.10)');
      gr.addColorStop(0.6, 'rgba(255,90,31,.03)');
      gr.addColorStop(1, 'rgba(7,7,8,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,.028)'; g.lineWidth = 1;
      const step = Math.max(38, Math.round(W / 20));
      g.beginPath();
      for (let x = step; x < W; x += step) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
      for (let y = step; y < H; y += step) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
      g.stroke();
      const pulse = (Math.sin(now / 260) + 1) / 2;
      g.fillStyle = `rgba(255,90,31,${(0.05 + pulse * 0.05).toFixed(3)})`;
      g.fillRect(0, H - 3 - pulse * 4, W, 3 + pulse * 4);
    };

    /* ---------- attract mode ---------- */
    if (!active) {
      const motes = Array.from({ length: 26 }, () => ({
        x: Math.random(), y: Math.random(), r: Math.random() * 2 + 0.8,
        v: Math.random() * 0.00022 + 0.00006, a: Math.random() * 0.5 + 0.15,
        t: Math.random() * 6.28
      }));
      const attract = now => {
        g.clearRect(0, 0, W, H);
        drawArena(now);
        for (const m of motes) {
          m.y -= m.v * 16; m.t += 0.012;
          if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); }
          const px = (m.x + Math.sin(m.t) * 0.012) * W, py = m.y * H;
          g.globalAlpha = m.a * (0.4 + Math.sin(m.t * 1.4) * 0.3);
          g.fillStyle = EMBER; g.shadowBlur = 12; g.shadowColor = EMBER;
          g.beginPath(); g.arc(px, py, m.r, 0, 7); g.fill();
          g.shadowBlur = 0; g.globalAlpha = 1;
        }
        raf = requestAnimationFrame(attract);
      };
      raf = requestAnimationFrame(attract);
      return () => { cancelAnimationFrame(raf); ro.disconnect(); };
    }

    /* ---------- live round ---------- */
    const G = { t0: performance.now(), score: 0, combo: 0, best: 1, hits: 0, next: 0, targets: [], fx: [] };

    const blip = (freq, dur, type, vol) => {
      if (mutedRef.current) return;
      try {
        const AC = audioRef.current || (audioRef.current = new (window.AudioContext || window.webkitAudioContext)());
        const o = AC.createOscillator(), gn = AC.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(freq, AC.currentTime);
        o.frequency.exponentialRampToValueAtTime(freq * 0.6, AC.currentTime + dur);
        gn.gain.setValueAtTime(vol || 0.06, AC.currentTime);
        gn.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
        o.connect(gn).connect(AC.destination);
        o.start(); o.stop(AC.currentTime + dur);
      } catch { /* no audio available */ }
    };

    const mult = () => Math.min(5, 1 + Math.floor(G.combo / 4) * 0.5);
    const burst = (x, y, c, n) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 7, s = Math.random() * 3.4 + 0.8;
        G.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: 1, c, r: Math.random() * 2.4 + 1 });
      }
    };
    const floater = (x, y, txt, c) => G.fx.push({ x, y, vx: 0, vy: -0.9, l: 1, txt, c });

    const spawnTarget = (prog, now) => {
      const m = Math.min(W, H), r = lerp(m * 0.075, m * 0.05, prog);
      const roll = Math.random();
      const type = roll < 0.16 ? 'dead' : roll < 0.30 ? 'hot' : 'spark';
      return {
        x: r + Math.random() * Math.max(1, W - r * 2),
        y: r + 34 + Math.random() * Math.max(1, H - r * 2 - 44),
        r: type === 'hot' ? r * 0.78 : r,
        born: now, life: lerp(1600, 950, prog) * (type === 'hot' ? 0.8 : 1), type
      };
    };

    const drawTarget = (t, age) => {
      const col = t.type === 'dead' ? DEAD : t.type === 'hot' ? HOT : EMBER;
      const grow = age < 0.12 ? Math.max(0, age) / 0.12 : 1;
      const r = Math.max(0, t.r * grow);
      g.save(); g.translate(t.x, t.y);
      g.shadowBlur = t.type === 'dead' ? 4 : 20; g.shadowColor = col;
      if (t.type === 'dead') g.fillStyle = 'rgba(28,9,6,.96)';
      else {
        const rg = g.createRadialGradient(-r * 0.14, -r * 0.14, 0, 0, 0, Math.max(1, r * 0.56));
        rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.4, col); rg.addColorStop(1, col);
        g.fillStyle = rg;
      }
      g.beginPath(); g.arc(0, 0, r * 0.52, 0, 7); g.fill();
      g.shadowBlur = 0;
      if (t.type === 'dead') {
        g.strokeStyle = '#c2431a'; g.lineWidth = 2.4; const k = r * 0.24;
        g.beginPath(); g.moveTo(-k, -k); g.lineTo(k, k); g.moveTo(k, -k); g.lineTo(-k, k); g.stroke();
      } else if (t.type === 'hot') {
        g.fillStyle = '#2a0d03';
        g.font = `700 ${Math.round(r * 0.46)}px JetBrains Mono, monospace`;
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('3x', 0, 1);
      }
      g.strokeStyle = col; g.globalAlpha = 0.8; g.lineWidth = 2.2;
      g.beginPath(); g.arc(0, 0, r * (1 - age * 0.42) + 4, -Math.PI / 2, -Math.PI / 2 + (1 - age) * Math.PI * 2); g.stroke();
      g.globalAlpha = 0.14; g.lineWidth = 1;
      g.beginPath(); g.arc(0, 0, r + 4, 0, 7); g.stroke();
      g.restore();
    };

    const hit = (px, py) => {
      for (let i = G.targets.length - 1; i >= 0; i--) {
        const t = G.targets[i];
        if (Math.hypot(px - t.x, py - t.y) <= t.r + 12) {
          const age = Math.min(1, Math.max(0, (performance.now() - t.born) / t.life));
          G.targets.splice(i, 1);
          if (t.type === 'dead') {
            G.score = Math.max(0, G.score - 150); G.combo = 0;
            burst(t.x, t.y, '#c2431a', 14); floater(t.x, t.y - t.r, '-150', '#ff8a6b');
            blip(120, 0.18, 'square', 0.07);
          } else {
            const pts = Math.round((t.type === 'hot' ? 250 : 100) * (1 + (1 - age) * 0.5) * mult());
            G.score += pts; G.combo++; G.hits++;
            G.best = Math.max(G.best, mult());
            const c = t.type === 'hot' ? HOT : EMBER;
            burst(t.x, t.y, c, t.type === 'hot' ? 22 : 12);
            floater(t.x, t.y - t.r, '+' + pts, c);
            blip(t.type === 'hot' ? 880 : 520 + Math.min(G.combo, 12) * 28, 0.09, 'triangle', 0.05);
          }
          return;
        }
      }
      G.combo = 0; burst(px, py, '#4a4340', 5);
    };
    const onDown = e => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      hit(e.clientX - r.left, e.clientY - r.top);
    };
    cv.addEventListener('pointerdown', onDown);

    const frame = now => {
      const elapsed = (now - G.t0) / 1000;
      const remain = Math.max(0, ROUND - elapsed), prog = Math.min(1, elapsed / ROUND);

      if (remain <= 0) {
        done = true;
        g.clearRect(0, 0, W, H);
        blip(220, 0.4, 'sine', 0.07);
        onFinish({ score: G.score, hits: G.hits, bestMult: G.best, durationMs: Math.round(elapsed * 1000) });
        return;
      }

      if (now >= G.next) {
        G.targets.push(spawnTarget(prog, now));
        G.next = now + lerp(780, 340, prog) * (0.75 + Math.random() * 0.5);
      }

      g.clearRect(0, 0, W, H);
      drawArena(now);

      for (let i = G.targets.length - 1; i >= 0; i--) {
        const t = G.targets[i], age = (now - t.born) / t.life;
        if (age >= 1) {
          G.targets.splice(i, 1);
          if (t.type === 'spark' && G.combo > 0) { G.combo = 0; floater(t.x, t.y, 'MISS', '#ff8a6b'); }
          continue;
        }
        drawTarget(t, age);
      }

      for (let i = G.fx.length - 1; i >= 0; i--) {
        const f = G.fx[i];
        f.x += f.vx; f.y += f.vy; f.vy += f.txt ? 0 : 0.09; f.l -= f.txt ? 0.018 : 0.026;
        if (f.l <= 0) { G.fx.splice(i, 1); continue; }
        g.globalAlpha = Math.max(0, f.l);
        if (f.txt) {
          g.fillStyle = f.c; g.font = '700 15px JetBrains Mono, monospace';
          g.textAlign = 'center'; g.fillText(f.txt, f.x, f.y);
        } else {
          g.fillStyle = f.c; g.shadowBlur = 8; g.shadowColor = f.c;
          g.beginPath(); g.arc(f.x, f.y, f.r, 0, 7); g.fill(); g.shadowBlur = 0;
        }
        g.globalAlpha = 1;
      }

      if (scoreRef.current) scoreRef.current.textContent = G.score.toLocaleString();
      if (comboRef.current) comboRef.current.textContent = mult().toFixed(1).replace('.0', '') + 'x';
      if (timeRef.current) timeRef.current.textContent = Math.ceil(remain);
      if (barRef.current) barRef.current.style.transform = `scaleX(${remain / ROUND})`;

      raf = requestAnimationFrame(frame);
    };

    blip(440, 0.12, 'triangle', 0.05);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      cv.removeEventListener('pointerdown', onDown);
      if (!done) g.clearRect(0, 0, W, H);
    };
  }, [active, onFinish]);

  return (
    <>
      <canvas id="game" ref={canvasRef} />
      {active && (
        <>
          <div className="hud">
            <div className="hud-item">Score<b ref={scoreRef}>0</b></div>
            <div className="hud-item hud-combo">Multiplier<b ref={comboRef}>1x</b></div>
            <div className="hud-spacer" />
            <div className="hud-item" style={{ textAlign: 'right' }}>Time<b ref={timeRef}>{ROUND}</b></div>
            <button className="x" style={{ marginLeft: 12 }} aria-label="Toggle sound"
                    onClick={() => setMuted(m => !m)}>{muted ? 'M' : 'S'}</button>
          </div>
          <div className="timerbar"><i ref={barRef} /></div>
        </>
      )}
    </>
  );
}
