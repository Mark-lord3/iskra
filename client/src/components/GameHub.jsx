import { useEffect, useMemo, useRef, useState } from 'react';
import { api, savedPlayer } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { useReducedMotion, usePageVisible } from '../hooks/useMotionPrefs.js';

/**
 * The arcade entrance.
 *
 * Every status shown here is read from the running application — the poker
 * lobby, the signed-in account, the player's own saved Spark Rush record — so
 * a chip that says LIVE is saying something true rather than decorative.
 */
export default function GameHub(){
  const { t } = useI18n();
  const reduced = useReducedMotion();

  const [account, setAccount] = useState(null);
  const [tournaments, setTournaments] = useState(null);
  const [player, setPlayer] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const saved = savedPlayer();
    Promise.all([
      api.accountMe().catch(() => null),
      api.pokerTournaments().catch(() => []),
      saved?.id ? api.playerStatus(saved.id).catch(() => null) : Promise.resolve(null)
    ]).then(([me, tours, status]) => {
      if(!alive) return;
      setAccount(me?.user || null);
      setTournaments(Array.isArray(tours) ? tours : []);
      setPlayer(status || saved || null);
      setReady(true);
    });
    return () => { alive = false; };
  }, []);

  /* Registration-open tournaments are the ones a visitor can actually join. */
  const openCount = useMemo(
    () => (tournaments || []).filter(x => x.state === 'registration_open').length,
    [tournaments]);
  const runningCount = useMemo(
    () => (tournaments || []).filter(x => ['round_one','round_two','final_round'].includes(x.state)).length,
    [tournaments]);

  const rank = player?.rank ?? player?.position ?? null;

  return (
    <section className={`hub ${ready ? 'is-ready' : ''} ${reduced ? 'is-calm' : ''}`}>
      <HubField reduced={reduced} />
      <span className="hub-scan" aria-hidden="true" />

      <div className="wrap hub-inner">
        <header className="hub-head">
          <p className="hub-eyebrow mono">{t('hub.eyebrow')}</p>

          {/* The space between the lines keeps the accessible name reading
              "PLAY THE NIGHT." rather than running the words together. */}
          <h1 className="hub-title">
            <span className="hub-title-line"><span>{t('hub.title1')}</span></span>{' '}
            <span className="hub-title-line"><span>{t('hub.title2')}</span></span>
          </h1>

          <p className="hub-lead">{t('hub.lead')}</p>

          {/* A short system read-out, from the same data as the chips below. */}
          <ul className="hub-system" aria-live="polite">
            <li><i className="hub-dot is-on" aria-hidden="true" />{t('hub.sysGames')}</li>
            <li><i className="hub-dot is-on" aria-hidden="true" />{t('hub.sysRewards')}</li>
            <li className="hub-system-node"><i className="hub-dot" aria-hidden="true" />{t('hub.sysNode')}</li>
            {account && <li className="hub-system-you">{t('hub.signedIn',{ name: account.name })}</li>}
          </ul>
        </header>

        <div className="hub-grid">
          <Portal
            kind="spark" index={0} href="/play/spark-rush"
            tag={t('hub.sparkTag')} line1={t('hub.sparkTitle1')} line2={t('hub.sparkTitle2')}
            copy={t('hub.sparkCopy')} cta={t('hub.sparkCta')}
            chips={[
              { label:t('hub.chipLive'), tone:'live' },
              { label:t('hub.chipNoAccount'), tone:'quiet' }
            ]}
            status={ready
              ? (rank ? t('hub.rank',{ rank }) : t('hub.newPlayer'))
              : t('hub.loadingStatus')}
            ready={ready} reduced={reduced} />

          <Portal
            kind="poker" index={1} href="/play/poker"
            tag={t('hub.pokerTag')} line1={t('hub.pokerTitle1')} line2={t('hub.pokerTitle2')}
            copy={t('hub.pokerCopy')} cta={t('hub.pokerCta')}
            chips={openCount > 0
              ? [{ label:t('hub.chipLive'), tone:'live' },
                 { label:t('hub.chipAccount'), tone:'quiet' },
                 { label:t('hub.chipFree'), tone:'quiet' }]
              : [{ label:t('hub.chipDemo'), tone:'demo' },
                 { label:t('hub.chipFree'), tone:'quiet' }]}
            status={!ready ? t('hub.loadingStatus')
              : openCount > 0 ? countLabel(t, 'hub.openTournaments', openCount)
              : runningCount > 0 ? countLabel(t, 'hub.runningTournaments', runningCount)
              : t('hub.demoOnly')}
            ready={ready} reduced={reduced} />

          {/* Unavailable: rendered as an article, never a link, so there is
              nothing to click and nothing for the keyboard to land on. */}
          <Portal
            kind="next" index={2} disabled
            tag={t('hub.nextTag')} line1={t('hub.nextTitle1')} line2={t('hub.nextTitle2')}
            copy={t('hub.nextCopy')} cta={t('hub.nextCta')}
            chips={[{ label:t('hub.chipSoon'), tone:'soon' }]}
            status={t('hub.unavailable')}
            ready={ready} reduced={reduced} />
        </div>

        <p className="hub-legal">{t('hub.legal')}</p>
      </div>
    </section>
  );
}

/** Picks the singular or plural form for a count. */
const countLabel = (t, key, count) =>
  t(count === 1 ? key : `${key}Plural`, { count });

/**
 * One game portal. Available games are a single link so the whole card is
 * clickable and reachable by keyboard; the unavailable one is inert markup.
 */
function Portal({ kind, index, href, disabled, tag, line1, line2, copy, cta, chips, status, ready, reduced }){
  const ref = useRef(null);

  /* The pointer nudges the card's light, not its geometry, so nothing reflows
     and there is no tilt to fight with. Touch gets the same treatment from the
     first contact point. */
  const track = event => {
    if(reduced || disabled) return;
    const node = ref.current;
    if(!node) return;
    const box = node.getBoundingClientRect();
    const point = event.touches?.[0] || event;
    node.style.setProperty('--mx', `${((point.clientX - box.left) / box.width) * 100}%`);
    node.style.setProperty('--my', `${((point.clientY - box.top) / box.height) * 100}%`);
  };
  const reset = () => {
    const node = ref.current;
    if(!node) return;
    node.style.removeProperty('--mx');
    node.style.removeProperty('--my');
  };

  const inner = <>
    <span className="hub-portal-art" aria-hidden="true" />
    <span className="hub-portal-tag mono">{tag}</span>

    <span className="hub-chips">
      {chips.map(chip => (
        <span key={chip.label} className={`hub-chip is-${chip.tone}`}>
          {chip.tone === 'live' && <i className="hub-dot is-on" aria-hidden="true" />}
          {chip.label}
        </span>
      ))}
    </span>

    <span className="hub-portal-title">
      <span>{line1}</span><span>{line2}</span>
    </span>

    <span className="hub-portal-copy">{copy}</span>
    <span className={`hub-portal-status ${ready ? '' : 'is-loading'}`}>{status}</span>
    <span className="hub-portal-cta">{cta}{!disabled && <i aria-hidden="true">→</i>}</span>
  </>;

  const className = `hub-portal is-${kind} ${disabled ? 'is-disabled' : ''}`;
  const style = { '--n': index };

  if(disabled) return <article ref={ref} className={className} style={style} aria-disabled="true">{inner}</article>;

  return (
    <a ref={ref} className={className} style={style} href={href}
       onMouseMove={track} onMouseLeave={reset}
       onTouchStart={track} onTouchMove={track} onTouchEnd={reset}>
      {inner}
    </a>
  );
}

/**
 * The background spark field.
 *
 * Canvas rather than DOM so the particle count costs nothing in layout. It
 * stops entirely when the tab is hidden or motion is reduced, and it thins
 * itself out on small screens to stay cheap on a phone.
 */
function HubField({ reduced }){
  const canvasRef = useRef(null);
  const visible = usePageVisible();

  useEffect(() => {
    const canvas = canvasRef.current;
    if(!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if(!ctx) return;

    let width = 0, height = 0, frame = 0, sparks = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const fit = () => {
      const box = canvas.parentElement.getBoundingClientRect();
      width = box.width; height = box.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Fewer particles on a small screen; this is decoration, not content.
      const count = Math.round(Math.min(64, Math.max(16, width / 26)));
      sparks = Array.from({ length: count }, () => spawn(true));
      if(reduced) paint(true);
    };

    const spawn = (seeded = false) => ({
      x: Math.random() * width,
      y: seeded ? Math.random() * height : height + 12,
      r: 0.6 + Math.random() * 1.7,
      vy: -(0.12 + Math.random() * 0.42),
      vx: (Math.random() - 0.5) * 0.16,
      life: 0, max: 260 + Math.random() * 420,
      hue: Math.random() < 0.22 ? 330 : 22        // mostly ember, a few plasma
    });

    const paint = still => {
      ctx.clearRect(0, 0, width, height);
      for(const s of sparks){
        const fade = still ? 0.5 : Math.sin((s.life / s.max) * Math.PI);
        ctx.globalAlpha = Math.max(0, Math.min(0.85, fade * 0.85));
        ctx.fillStyle = `hsl(${s.hue} 100% ${s.hue === 330 ? 62 : 56}%)`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const step = () => {
      for(let i = 0; i < sparks.length; i++){
        const s = sparks[i];
        s.x += s.vx; s.y += s.vy; s.life += 1;
        if(s.life > s.max || s.y < -12) sparks[i] = spawn();
      }
      paint(false);
      frame = requestAnimationFrame(step);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(canvas.parentElement);

    if(!reduced && visible) frame = requestAnimationFrame(step);
    else paint(true);

    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [reduced, visible]);

  return <canvas ref={canvasRef} className="hub-field" aria-hidden="true" />;
}
