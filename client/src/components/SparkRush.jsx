import { useCallback, useEffect, useRef, useState } from 'react';

export const ROUND = 60;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ISKRA palette. Every colour drawn to the canvas comes from this table so the
   game cannot drift away from the brand. */
const C = {
  spark:  '#ff5c1a',
  ember:  '#c6ff3d',
  dud:    '#ff2e8b',
  runner: '#6e56ff',
  hot:    '#ffd9c2',
  miss:   '#ff8a6b'
};

const TYPES = {
  spark:  { base: 100, color: C.spark,  radius: 1.0 },
  ember:  { base: 250, color: C.ember,  radius: 0.78 },
  runner: { base: 180, color: C.runner, radius: 0.86 },
  dud:    { base: -150, color: C.dud,   radius: 1.0 }
};

/**
 * Spark Rush.
 *
 * All per-frame state lives in refs and a single pooled arrays set; React never
 * re-renders during play. The HUD is written straight to the DOM at frame rate.
 * Targets have behaviour (jitter, jump, dodge, near-miss recoil) and difficulty
 * adapts to how well the round is going.
 */
export default function SparkRush({
  active, paused = false, onFinish, onEvent, reducedMotion = false, muted = false,
  onTogglePause, onToggleSound, labels = {}
}) {
  const canvasRef = useRef(null);
  const scoreRef = useRef(null), multRef = useRef(null), timeRef = useRef(null), barRef = useRef(null);
  const pointer = useRef({ x: -999, y: -999 });
  const audioRef = useRef(null);
  const mutedRef = useRef(muted);
  const pausedRef = useRef(paused);
  const [ready, setReady] = useState(false);

  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const emit = useCallback((type, payload) => { onEvent?.(type, payload); }, [onEvent]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const g = cv.getContext('2d', { alpha: true });
    let W = 0, H = 0, raf = 0, finished = false;

    const fit = () => {
      const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(cv);
    setReady(true);

    /* ---------------- audio ---------------- */
    const blip = (freq, dur, type, vol) => {
      if (mutedRef.current) return;
      try {
        const AC = audioRef.current ||
          (audioRef.current = new (window.AudioContext || window.webkitAudioContext)());
        if (AC.state === 'suspended') AC.resume();
        const o = AC.createOscillator(), gn = AC.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(freq, AC.currentTime);
        o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.6), AC.currentTime + dur);
        gn.gain.setValueAtTime(vol || 0.05, AC.currentTime);
        gn.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
        o.connect(gn).connect(AC.destination);
        o.start(); o.stop(AC.currentTime + dur);
      } catch { /* audio unavailable */ }
    };

    /* ---------------- pools ----------------
       Particles and floating labels are allocated once and recycled, so a long
       round never triggers garbage collection mid-frame. */
    const PARTS = 260, LABELS = 24;
    const parts = Array.from({ length: PARTS }, () => ({ life: 0, x:0, y:0, vx:0, vy:0, r:1, c:'#fff' }));
    const labels = Array.from({ length: LABELS }, () => ({ life: 0, x:0, y:0, text:'', c:'#fff', size:15 }));
    let partHead = 0, labelHead = 0;

    const spawnParticles = (x, y, color, n, power = 1) => {
      for (let i = 0; i < n; i++) {
        const p = parts[partHead = (partHead + 1) % PARTS];
        const a = Math.random() * Math.PI * 2, sp = (Math.random() * 3.2 + 0.7) * power;
        p.x = x; p.y = y; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
        p.life = 1; p.r = Math.random() * 2.3 + 1; p.c = color;
      }
    };
    const spawnLabel = (x, y, text, c, size = 15) => {
      const l = labels[labelHead = (labelHead + 1) % LABELS];
      l.x = x; l.y = y; l.text = text; l.c = c; l.life = 1; l.size = size;
    };

    /* ---------------- round state ---------------- */
    const G = {
      startedAt: performance.now(), pausedFor: 0, pauseMark: 0,
      score: 0, combo: 0, bestMult: 1, hits: 0, misses: 0, spawned: 0,
      next: 0, targets: [], shake: 0, flash: 0, heat: 0
    };
    const mult = () => Math.min(5, 1 + Math.floor(G.combo / 4) * 0.5);

    /* Difficulty rises with elapsed time and with how cleanly the player is
       hitting, so a strong run gets faster and a weak one stays playable. */
    const pressure = prog => clamp(prog * 0.7 + G.heat * 0.3, 0, 1);

    const makeTarget = (prog, now) => {
      const m = Math.min(W, H);
      const p = pressure(prog);
      const roll = Math.random();
      let kind = 'spark';
      if (roll < 0.15) kind = 'dud';
      else if (roll < 0.30) kind = 'ember';
      else if (roll < 0.30 + p * 0.22) kind = 'runner';

      const spec = TYPES[kind];
      const r = lerp(m * 0.078, m * 0.046, p) * spec.radius;
      return {
        kind, r,
        x: r + 12 + Math.random() * Math.max(1, W - r * 2 - 24),
        y: r + 46 + Math.random() * Math.max(1, H - r * 2 - 70),
        born: now,
        life: lerp(1750, 900, p) * (kind === 'ember' ? 0.82 : 1),
        vx: 0, vy: 0,
        jumped: false,
        recoil: 0,          // near-miss reaction
        seed: Math.random() * 6.28
      };
    };

    /* ---------------- drawing ---------------- */
    const drawArena = (now, prog) => {
      const cx = W / 2, cy = H * 0.56;
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.78);
      grd.addColorStop(0, `rgba(255,92,26,${(0.10 + prog * 0.06).toFixed(3)})`);
      grd.addColorStop(0.55, 'rgba(110,86,255,.05)');
      grd.addColorStop(1, 'rgba(7,5,10,0)');
      g.fillStyle = grd; g.fillRect(0, 0, W, H);

      // Moving grid: the floor of the arcade, drifting with the round.
      const step = Math.max(34, Math.round(W / 22));
      const drift = ((now / 60) % step);
      g.strokeStyle = 'rgba(255,255,255,.030)'; g.lineWidth = 1;
      g.beginPath();
      for (let x = -step + drift; x < W; x += step) { g.moveTo(x + .5, 0); g.lineTo(x + .5, H); }
      for (let y = -step + drift; y < H; y += step) { g.moveTo(0, y + .5); g.lineTo(W, y + .5); }
      g.stroke();

      // Scan lines, fixed and cheap.
      g.fillStyle = 'rgba(0,0,0,.16)';
      for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);

      const pulse = (Math.sin(now / 240) + 1) / 2;
      g.fillStyle = `rgba(255,92,26,${(0.05 + pulse * 0.05).toFixed(3)})`;
      g.fillRect(0, H - 3 - pulse * 4, W, 3 + pulse * 4);
    };

    const drawTarget = (t, age, now) => {
      const spec = TYPES[t.kind];
      const grow = age < 0.11 ? Math.max(0, age) / 0.11 : 1;
      // Late in its life a target shakes; a near miss makes it recoil harder.
      const panic = age > 0.62 ? (age - 0.62) / 0.38 : 0;
      const wob = (panic * 3 + t.recoil * 7) * Math.sin(now / 46 + t.seed);
      const r = Math.max(0, t.r * grow * (1 + t.recoil * 0.12));

      g.save();
      g.translate(t.x + wob, t.y + wob * 0.5);
      g.shadowBlur = t.kind === 'dud' ? 8 : 22;
      g.shadowColor = spec.color;

      if (t.kind === 'dud') {
        g.fillStyle = 'rgba(38,8,22,.96)';
      } else {
        const rg = g.createRadialGradient(-r * .16, -r * .16, 0, 0, 0, Math.max(1, r * .58));
        rg.addColorStop(0, '#ffffff');
        rg.addColorStop(0.4, spec.color);
        rg.addColorStop(1, spec.color);
        g.fillStyle = rg;
      }
      g.beginPath(); g.arc(0, 0, r * 0.52, 0, 7); g.fill();
      g.shadowBlur = 0;

      if (t.kind === 'dud') {
        g.strokeStyle = C.dud; g.lineWidth = 2.4;
        const k = r * 0.24;
        g.beginPath(); g.moveTo(-k, -k); g.lineTo(k, k); g.moveTo(k, -k); g.lineTo(-k, k); g.stroke();
      } else if (t.kind === 'ember') {
        g.fillStyle = '#14200a';
        g.font = `700 ${Math.round(r * 0.44)}px JetBrains Mono, monospace`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('3x', 0, 1);
      }

      // Countdown ring.
      g.strokeStyle = spec.color; g.globalAlpha = 0.85; g.lineWidth = 2.4;
      g.beginPath();
      g.arc(0, 0, r * (1 - age * 0.4) + 4, -Math.PI / 2, -Math.PI / 2 + (1 - age) * Math.PI * 2);
      g.stroke();
      g.globalAlpha = 0.14; g.lineWidth = 1;
      g.beginPath(); g.arc(0, 0, r + 4, 0, 7); g.stroke();
      g.restore();
    };

    /* ---------------- input ---------------- */
    const localPoint = e => {
      const r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const hit = (px, py) => {
      if (pausedRef.current) return;
      for (let i = G.targets.length - 1; i >= 0; i--) {
        const t = G.targets[i];
        const d = Math.hypot(px - t.x, py - t.y);
        if (d <= t.r + 14) {
          const age = clamp((performance.now() - t.born) / t.life, 0, 1);
          G.targets.splice(i, 1);
          if (t.kind === 'dud') {
            G.score = Math.max(0, G.score + TYPES.dud.base);
            G.combo = 0; G.heat = Math.max(0, G.heat - 0.25);
            spawnParticles(t.x, t.y, C.dud, 16, 1.2);
            spawnLabel(t.x, t.y - t.r, '-150', C.dud);
            blip(120, .18, 'square', .07);
            emit('dud');
          } else {
            const accuracy = 1 + (1 - age) * 0.5;
            const pts = Math.round(TYPES[t.kind].base * accuracy * mult());
            G.score += pts; G.combo++; G.hits++;
            G.heat = Math.min(1, G.heat + 0.06);
            G.bestMult = Math.max(G.bestMult, mult());
            const col = t.kind === 'ember' ? C.ember : t.kind === 'runner' ? C.runner : C.spark;
            spawnParticles(t.x, t.y, col, t.kind === 'ember' ? 26 : 14, t.kind === 'ember' ? 1.4 : 1);
            spawnLabel(t.x, t.y - t.r, '+' + pts, col, t.kind === 'ember' ? 19 : 15);
            // Shake is reserved for moments that matter, never routine hits.
            if (!reducedMotion && (t.kind === 'ember' || G.combo % 8 === 0)) G.shake = Math.min(9, 5 + G.combo * 0.08);
            if (G.combo % 4 === 0) { G.flash = 1; emit('combo', { combo: G.combo, mult: mult() }); }
            blip(t.kind === 'ember' ? 880 : 520 + Math.min(G.combo, 14) * 26, .09, 'triangle', .05);
            emit('hit', { kind: t.kind, points: pts });
          }
          return true;
        }
      }
      G.combo = 0;
      spawnParticles(px, py, '#5a4a66', 6, 0.6);
      return false;
    };

    const onDown = e => {
      e.preventDefault();
      const { x, y } = localPoint(e);
      pointer.current = { x, y };
      hit(x, y);
    };
    const onMove = e => { const p = localPoint(e); pointer.current = p; };
    const onLeave = () => { pointer.current = { x: -999, y: -999 }; };

    // pointer events cover mouse, touch and pen on iOS and Android alike.
    cv.addEventListener('pointerdown', onDown, { passive: false });
    cv.addEventListener('pointermove', onMove, { passive: true });
    cv.addEventListener('pointerleave', onLeave, { passive: true });

    /* ---------------- attract mode ---------------- */
    if (!active) {
      const motes = Array.from({ length: 30 }, () => ({
        x: Math.random(), y: Math.random(), r: Math.random() * 2 + 0.8,
        v: Math.random() * 0.0004 + 0.00012, a: Math.random() * 0.5 + 0.18, t: Math.random() * 6.28
      }));
      const attract = now => {
        g.clearRect(0, 0, W, H);
        drawArena(now, 0);
        for (const m of motes) {
          m.y -= m.v * 16; m.t += 0.012;
          if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); }
          const px = (m.x + Math.sin(m.t) * 0.014) * W, py = m.y * H;
          g.globalAlpha = m.a * (0.45 + Math.sin(m.t * 1.5) * 0.3);
          g.fillStyle = C.spark; g.shadowBlur = 12; g.shadowColor = C.spark;
          g.beginPath(); g.arc(px, py, m.r, 0, 7); g.fill();
          g.shadowBlur = 0; g.globalAlpha = 1;
        }
        raf = requestAnimationFrame(attract);
      };
      raf = requestAnimationFrame(attract);
      return () => {
        cancelAnimationFrame(raf); ro.disconnect();
        cv.removeEventListener('pointerdown', onDown);
        cv.removeEventListener('pointermove', onMove);
        cv.removeEventListener('pointerleave', onLeave);
      };
    }

    /* ---------------- live round ---------------- */
    emit('start');
    blip(440, .12, 'triangle', .05);

    const frame = now => {
      if (pausedRef.current) {
        if (!G.pauseMark) G.pauseMark = now;
        raf = requestAnimationFrame(frame);
        return;
      }
      if (G.pauseMark) { G.pausedFor += now - G.pauseMark; G.pauseMark = 0; }

      const elapsed = (now - G.startedAt - G.pausedFor) / 1000;
      const remain = Math.max(0, ROUND - elapsed);
      const prog = clamp(elapsed / ROUND, 0, 1);

      if (remain <= 0) {
        finished = true;
        g.clearRect(0, 0, W, H);
        blip(220, .4, 'sine', .07);
        onFinish?.({
          score: G.score, hits: G.hits, bestMult: G.bestMult,
          durationMs: Math.round(elapsed * 1000),
          accuracy: G.spawned ? Math.round((G.hits / G.spawned) * 100) : 0
        });
        return;
      }

      if (now >= G.next) {
        G.targets.push(makeTarget(prog, now));
        G.spawned++;
        G.next = now + lerp(820, 330, pressure(prog)) * (0.72 + Math.random() * 0.5);
      }

      g.setTransform(Math.min(devicePixelRatio || 1, 2), 0, 0, Math.min(devicePixelRatio || 1, 2), 0, 0);
      g.clearRect(0, 0, W, H);

      // Screen shake, applied as a transform so nothing re-lays out.
      if (G.shake > 0.2) {
        const s = G.shake;
        g.translate((Math.random() - .5) * s, (Math.random() - .5) * s);
        G.shake *= 0.86;
      }

      drawArena(now, prog);

      /* --- targets: movement, reactions, expiry --- */
      const pt = pointer.current;
      for (let i = G.targets.length - 1; i >= 0; i--) {
        const t = G.targets[i];
        const age = (now - t.born) / t.life;
        if (age >= 1) {
          G.targets.splice(i, 1);
          if (t.kind !== 'dud') {
            if (G.combo > 0) spawnLabel(t.x, t.y, 'MISS', C.miss, 13);
            G.combo = 0; G.misses++;
            G.heat = Math.max(0, G.heat - 0.08);
            emit('miss');
          }
          continue;
        }

        const dist = Math.hypot(pt.x - t.x, pt.y - t.y);

        // Runners slide away from the pointer; everything else can jump once.
        if (t.kind === 'runner' && dist < t.r * 4.2 && dist > 0.001) {
          const push = (1 - dist / (t.r * 4.2)) * 2.4;
          t.vx += ((t.x - pt.x) / dist) * push;
          t.vy += ((t.y - pt.y) / dist) * push;
        } else if (!t.jumped && age > 0.5 && t.kind === 'spark' && Math.random() < 0.03) {
          t.jumped = true;
          t.x = t.r + 12 + Math.random() * Math.max(1, W - t.r * 2 - 24);
          t.y = t.r + 46 + Math.random() * Math.max(1, H - t.r * 2 - 70);
          spawnParticles(t.x, t.y, C.spark, 8, 0.6);
        }

        // Near miss: the pointer swept close without connecting.
        if (dist > t.r + 14 && dist < t.r + 44) {
          if (t.recoil < 0.2) { t.recoil = 1; emit('near'); }
        }
        t.recoil *= 0.9;

        t.vx *= 0.9; t.vy *= 0.9;
        t.x = clamp(t.x + t.vx, t.r + 8, W - t.r - 8);
        t.y = clamp(t.y + t.vy, t.r + 44, H - t.r - 12);

        drawTarget(t, age, now);
      }

      /* --- pooled particles --- */
      for (const p of parts) {
        if (p.life <= 0) continue;
        p.x += p.vx; p.y += p.vy; p.vy += 0.09; p.life -= 0.026;
        if (p.life <= 0) continue;
        g.globalAlpha = Math.max(0, p.life);
        g.fillStyle = p.c; g.shadowBlur = 8; g.shadowColor = p.c;
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill();
      }
      g.shadowBlur = 0; g.globalAlpha = 1;

      /* --- score popups and hit markers --- */
      g.textAlign = 'center';
      for (const l of labels) {
        if (l.life <= 0) continue;
        l.y -= 0.9; l.life -= 0.018;
        if (l.life <= 0) continue;
        g.globalAlpha = Math.max(0, l.life);
        g.fillStyle = l.c;
        g.font = `700 ${l.size}px JetBrains Mono, monospace`;
        g.fillText(l.text, l.x, l.y);
      }
      g.globalAlpha = 1;

      /* --- combo flash --- */
      if (G.flash > 0.02) {
        g.fillStyle = `rgba(198,255,61,${(G.flash * 0.10).toFixed(3)})`;
        g.fillRect(0, 0, W, H);
        G.flash *= 0.84;
      }

      if (scoreRef.current) scoreRef.current.textContent = G.score.toLocaleString();
      if (multRef.current)  multRef.current.textContent = mult().toFixed(1).replace('.0', '') + 'x';
      if (timeRef.current)  timeRef.current.textContent = Math.ceil(remain);
      if (barRef.current)   barRef.current.style.transform = `scaleX(${remain / ROUND})`;

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      cv.removeEventListener('pointerdown', onDown);
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerleave', onLeave);
      if (!finished) g.clearRect(0, 0, W, H);
    };
  }, [active, onFinish, emit, reducedMotion]);

  return (
    <>
      <canvas id="game" ref={canvasRef} aria-hidden={!active} data-ready={ready} />

      {/* The HUD sits on the rails of the arena, never over the play area. */}
      {active && (
        <>
          <div className="hud" role="status" aria-live="off">
            <div className="hud-item"><span>{labels.score}</span><b ref={scoreRef}>0</b></div>
            <div className="hud-item hud-combo"><span>{labels.multiplier}</span><b ref={multRef}>1x</b></div>
            <div className="hud-spacer" />
            <div className="hud-item hud-time"><span>{labels.time}</span><b ref={timeRef}>{ROUND}</b></div>
            <div className="hud-controls">
              <button type="button" className="hud-btn" onClick={onToggleSound}
                      aria-pressed={!muted} title={muted ? labels.soundOff : labels.soundOn}>
                <span aria-hidden="true">{muted ? '□' : '▣'}</span>
                <span className="sr-only">{muted ? labels.soundOff : labels.soundOn}</span>
              </button>
              <button type="button" className="hud-btn" onClick={onTogglePause}
                      aria-pressed={paused} title={paused ? labels.resume : labels.pause}>
                <span aria-hidden="true">{paused ? '▶' : '❙❙'}</span>
                <span className="sr-only">{paused ? labels.resume : labels.pause}</span>
              </button>
            </div>
          </div>
          <div className="timerbar"><i ref={barRef} /></div>
          {paused && (
            <div className="arena-paused">
              <p className="h-md">{labels.paused}</p>
              <button className="btn btn-primary" onClick={onTogglePause}>{labels.resume}</button>
            </div>
          )}
        </>
      )}
    </>
  );
}

export { C as ARCADE_COLORS };
