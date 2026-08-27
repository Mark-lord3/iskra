import { useEffect, useRef } from 'react';

/* ISKRA palette only. Nothing blue, nothing outside the established set. */
const C = {
  spark:'#ff5c1a', plasma:'#ff2e8b', volt:'#6e56ff', acid:'#c6ff3d', bone:'#f6f2f8'
};
const TRAILS = [C.spark, C.plasma, C.volt, C.acid];

/**
 * The cosmic backdrop: layered stars, nebula haze, orbital arcs and original
 * craft silhouettes.
 *
 * Everything lives on one canvas driven by a single requestAnimationFrame loop
 * and plain refs, so React never re-renders while it runs. The loop stops when
 * the tab is hidden or the section scrolls out of view, and under
 * prefers-reduced-motion it paints one static composition and exits.
 */
export default function CosmicField({ safeSelector, density = 1 }) {
  const canvasRef = useRef(null);
  const pointer = useRef({ x: 0.5, y: 0.4, active: false });

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const g = cv.getContext('2d', { alpha: true });
    if (!g) return;                              // CSS starfield fallback shows through

    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    let W = 0, H = 0, raf = 0, running = false, t = 0;

    const fit = () => {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      // Under reduced motion nothing repaints on its own, so the static
      // composition has to be drawn again whenever the size changes.
      if (calm) render(0);
    };

    /* ---------- world ---------- */
    let stars = [], ships = [], motes = [], arcs = [];

    // Bands the craft are allowed to fly through. The middle of the screen is
    // left clear so nothing ever crosses the headline or the form.
    const laneFor = depth => (depth < 0.45 ? 0.06 + Math.random() * 0.16 : 0.78 + Math.random() * 0.16);

    const makeShip = (depth, x) => ({
      depth,                                   // 0 far .. 1 near
      x, y: laneFor(depth),
      speed: (depth > 0.7 ? 0.008 : 0.014 + depth * 0.030) * (Math.random() < 0.5 ? 1 : -1),
      scale: 0.35 + depth * 1.25,
      bank: 0, drift: 0,
      trail: TRAILS[(Math.random() * TRAILS.length) | 0],
      hazeAt: Math.random(),                   // where it slips behind haze
      kind: depth > 0.7 ? 'hero' : (Math.random() < 0.5 ? 'runner' : 'relay')
    });

    function build() {
      const area = (W * H) / 1e6;
      const starCount = Math.round(Math.min(620, 260 * area * density));
      stars = Array.from({ length: starCount }, () => ({
        x: Math.random(), y: Math.random(),
        z: Math.random(),                      // depth for parallax
        r: Math.random() * 1.5 + 0.35,
        tw: Math.random() * 6.28,
        c: Math.random() < 0.08 ? (Math.random() < 0.5 ? C.spark : C.volt) : C.bone
      }));

      const shipCount = Math.max(2, Math.round(4 * density));
      ships = Array.from({ length: shipCount }, (_, i) =>
        makeShip(i === 0 ? 0.92 : 0.12 + Math.random() * 0.45, Math.random()));

      motes = Array.from({ length: Math.round(26 * density) }, () => ({
        x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + 0.5,
        v: Math.random() * 0.00016 + 0.00004, a: Math.random() * 0.4 + 0.1
      }));

      arcs = [
        { r: 0.62, tilt: -0.22, c: C.spark, a: 0.16 },
        { r: 0.86, tilt: 0.16,  c: C.volt,  a: 0.13 }
      ];
    }

    /* ---------- drawing ---------- */
    function nebula() {
      const blobs = [
        [0.18, 0.22, 0.55, 'rgba(255,92,26,0.26)'],
        [0.82, 0.30, 0.50, 'rgba(110,86,255,0.26)'],
        [0.55, 0.86, 0.60, 'rgba(255,46,139,0.16)']
      ];
      for (const [x, y, r, col] of blobs) {
        const gr = g.createRadialGradient(x * W, y * H, 0, x * W, y * H, r * Math.max(W, H));
        gr.addColorStop(0, col);
        gr.addColorStop(1, 'rgba(7,5,10,0)');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
      }
    }

    function orbitals(time) {
      g.save();
      g.translate(W * 0.5, H * 0.52);
      for (const a of arcs) {
        g.rotate(a.tilt + time * 0.00002);
        g.strokeStyle = a.c; g.globalAlpha = a.a; g.lineWidth = 1;
        g.beginPath();
        g.ellipse(0, 0, a.r * W * 0.62, a.r * H * 0.30, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.restore();
    }

    function starfield(time) {
      const px = (pointer.current.x - 0.5), py = (pointer.current.y - 0.5);
      for (const s of stars) {
        // Nearer stars shift further with the pointer: cheap parallax.
        const shift = fine ? (s.z * 26) : 0;
        const x = s.x * W - px * shift;
        const y = s.y * H - py * shift * 0.6;
        const tw = calm ? 0.8 : 0.55 + Math.sin(time * 0.0016 + s.tw) * 0.45;
        g.globalAlpha = (0.38 + s.z * 0.62) * tw;
        g.fillStyle = s.c;
        g.fillRect(x, y, s.r + s.z, s.r + s.z);
      }
      g.globalAlpha = 1;
    }

    /* Original silhouettes. Angular broadcast craft with dish and fins, drawn
       from paths so they stay sharp at any size and weigh nothing. */
    function shipPath(kind, s) {
      g.beginPath();
      if (kind === 'hero') {
        g.moveTo(-46 * s, 0); g.lineTo(-18 * s, -9 * s); g.lineTo(30 * s, -7 * s);
        g.lineTo(52 * s, 0);  g.lineTo(30 * s, 7 * s);   g.lineTo(-18 * s, 9 * s);
        g.closePath();
        g.moveTo(-6 * s, -9 * s);  g.lineTo(2 * s, -22 * s); g.lineTo(12 * s, -9 * s); // dorsal fin
        g.moveTo(-10 * s, 9 * s);  g.lineTo(-4 * s, 20 * s); g.lineTo(6 * s, 9 * s);   // ventral fin
      } else if (kind === 'relay') {
        g.moveTo(-24 * s, 0); g.lineTo(-6 * s, -7 * s); g.lineTo(20 * s, -4 * s);
        g.lineTo(28 * s, 0);  g.lineTo(20 * s, 4 * s);  g.lineTo(-6 * s, 7 * s);
        g.closePath();
        g.moveTo(0, -7 * s); g.lineTo(4 * s, -16 * s); g.lineTo(10 * s, -7 * s);       // dish mast
      } else {
        g.moveTo(-18 * s, 0); g.lineTo(-4 * s, -5 * s); g.lineTo(18 * s, 0);
        g.lineTo(-4 * s, 5 * s); g.closePath();
      }
    }

    function drawShip(sh, time) {
      const x = sh.x * W, y = sh.y * H;
      const dir = Math.sign(sh.speed) || 1;
      // Haze pockets: the craft dims as it passes behind nebula.
      const haze = 0.55 + 0.45 * Math.sin((sh.x - sh.hazeAt) * Math.PI * 2);
      const alpha = (0.40 + sh.depth * 0.55) * haze;
      if (alpha <= 0.02) return;

      g.save();
      g.translate(x, y);
      g.rotate(sh.bank);
      g.scale(dir, 1);
      // Distant craft read as blurred: approximated with a soft shadow rather
      // than an expensive filter.
      g.globalAlpha = alpha;

      // engine trail
      const tl = (60 + sh.depth * 150) * sh.scale;
      const tr = g.createLinearGradient(-tl, 0, 0, 0);
      tr.addColorStop(0, 'rgba(0,0,0,0)');
      tr.addColorStop(1, sh.trail);
      g.strokeStyle = tr;
      g.lineWidth = Math.max(1, 2.4 * sh.scale);
      g.beginPath(); g.moveTo(-tl, 0); g.lineTo(-16 * sh.scale, 0); g.stroke();

      // hull: a lit top edge falling into near-black, so the craft reads as a
      // solid silhouette rather than an outline floating on the background
      const hull = g.createLinearGradient(0, -26 * sh.scale, 0, 22 * sh.scale);
      hull.addColorStop(0, 'rgba(46,36,64,0.98)');
      hull.addColorStop(0.45, 'rgba(20,15,30,0.98)');
      hull.addColorStop(1, 'rgba(6,5,10,0.99)');
      g.shadowBlur = sh.depth < 0.4 ? 10 : 22;
      g.shadowColor = sh.trail;
      g.fillStyle = hull;
      shipPath(sh.kind, sh.scale);
      g.fill();
      g.shadowBlur = 0;
      // rim light along the leading edge
      g.strokeStyle = sh.trail;
      g.globalAlpha = alpha * 0.9;
      g.lineWidth = Math.max(0.8, 1.4 * sh.scale);
      shipPath(sh.kind, sh.scale);
      g.stroke();

      // engine glow
      g.globalAlpha = alpha;
      g.fillStyle = sh.trail;
      g.beginPath();
      g.arc(-16 * sh.scale, 0, Math.max(1, 2.2 * sh.scale) * (0.8 + Math.sin(time * 0.006) * 0.2), 0, 7);
      g.fill();
      g.restore();
      g.globalAlpha = 1;
    }

    function dust(time) {
      for (const m of motes) {
        if (!calm) { m.y -= m.v * 60; if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); } }
        g.globalAlpha = m.a * (0.5 + Math.sin(time * 0.001 + m.x * 9) * 0.4);
        g.fillStyle = C.spark;
        g.beginPath(); g.arc(m.x * W, m.y * H, m.r, 0, 7); g.fill();
      }
      g.globalAlpha = 1;
    }

    function render(time) {
      g.clearRect(0, 0, W, H);
      nebula();
      orbitals(time);
      starfield(time);
      for (const sh of ships) drawShip(sh, time);
      dust(time);
    }

    function step(time) {
      t = time;
      for (const sh of ships) {
        sh.x += sh.speed / 100;
        if (sh.x > 1.25) { Object.assign(sh, makeShip(sh.depth, -0.25)); }
        if (sh.x < -0.25) { Object.assign(sh, makeShip(sh.depth, 1.25)); }

        // A craft banks away when the pointer nears its lane.
        if (fine && pointer.current.active) {
          const dx = pointer.current.x - sh.x, dy = pointer.current.y - sh.y;
          const d = Math.hypot(dx, dy * 1.6);
          const react = d < 0.18 ? (1 - d / 0.18) : 0;
          sh.bank += ((-dy * react * 0.5) - sh.bank) * 0.06;
          sh.y += (react * (dy > 0 ? -0.0016 : 0.0016));
        } else {
          sh.bank += (Math.sin(time * 0.0004 + sh.hazeAt * 6) * 0.05 - sh.bank) * 0.04;
        }
      }
      render(time);
      raf = requestAnimationFrame(step);
    }

    const start = () => { if (running || calm) return; running = true; raf = requestAnimationFrame(step); };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    fit();
    if (calm) { render(0); }                    // one beautiful static frame
    else start();

    /* ---------- lifecycle ---------- */
    const ro = new ResizeObserver(fit); ro.observe(cv);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);

    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0 });
    io.observe(cv);

    const onMove = e => {
      pointer.current.x = e.clientX / innerWidth;
      pointer.current.y = e.clientY / innerHeight;
      pointer.current.active = true;
    };
    const onLeave = () => { pointer.current.active = false; };
    if (fine) { addEventListener('pointermove', onMove, { passive: true });
                addEventListener('pointerleave', onLeave, { passive: true }); }

    return () => {
      stop(); ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerleave', onLeave);
    };
  }, [density, safeSelector]);

  // Decorative only: never announced, never focusable.
  return <canvas className="cosmos" ref={canvasRef} aria-hidden="true" role="presentation" />;
}
