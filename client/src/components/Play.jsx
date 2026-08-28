import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SparkRush, { ROUND } from './SparkRush.jsx';
import Leaderboard from './Leaderboard.jsx';
import MeltText from './MeltText.jsx';
import { api, savedPlayer, savePlayer, clearPlayer } from '../api.js';
import { contestBadge, msUntilClose, canPlay, canRegister, participantMeter,
         countdownParts, rewardZone, closedState, LADDER } from '../arcade/contest.js';
import { useToast } from './Toasts.jsx';
import { useI18n } from '../i18n.jsx';
import { pad } from '../utils.js';

const NAME_MESSAGE = {
  NAME_BLOCKED: 'arcade.nameBlocked',
  NAME_LENGTH:  'arcade.nameLength',
  NAME_LETTERS: 'arcade.nameLetters'
};

const newRoundId = () =>
  (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** Digits that roll up to their value, used for the score and credit readouts. */
function Odometer({ value, className = '' }) {
  const [shown, setShown] = useState(value);
  const raf = useRef(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return; }
    const from = shown, delta = value - from, t0 = performance.now(), dur = 700;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur);
      setShown(Math.round(from + delta * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <b className={className}>{shown.toLocaleString()}</b>;
}

function ContestWindow({contest,t}){
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id);},[]);
  if(!contest)return <div className="arcade-window closed"><span>{t('arcade.noEvent')}</span></div>;
  const left=Math.max(0,new Date(contest.closesAt).getTime()-now);
  const values=[Math.floor(left/86400000),Math.floor(left/3600000)%24,Math.floor(left/60000)%60,Math.floor(left/1000)%60];
  return <div className={`arcade-window ${contest.status}`}>
    <div><span>{contest.status==='open'?t('arcade.playingFor'):t('arcade.boardFor')}</span><b>{contest.eventTitle}</b></div>
    {contest.status==='open'?<div className="arcade-countdown" aria-label={t('arcade.closesIn')}>
      {values.map((value,index)=><span key={index}><b>{String(value).padStart(2,'0')}</b><small>{['D','H','M','S'][index]}</small></span>)}
    </div>:<div><span>{contest.status==='finalized'?t('arcade.finalized'):t('arcade.closed')}</span><b>{contest.participantCount}/{contest.minParticipants}</b></div>}
    <div><span>{t('arcade.qualified')}</span><b>{contest.participantCount}/{contest.minParticipants}</b><small>{contest.entriesNeeded>0?t('arcade.needEntries',{count:contest.entriesNeeded}):t('arcade.thresholdMet')}</small></div>
  </div>;
}

export default function Play({ onTickets, onReward }) {
  const toast = useToast();
  const { t } = useI18n();

  const [player, setPlayer]   = useState(savedPlayer);
  const [accountLinked, setAccountLinked] = useState(false);
  const [screen, setScreen]   = useState('loading');   // loading|signup|ready|playing|submitting|over|spent
  const [board, setBoard]     = useState([]);
  const [me, setMe]           = useState(null);
  const [boardStatus, setBoardStatus] = useState('loading');
  const [updatedAt, setUpdatedAt]     = useState(null);
  const [contest,setContest] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [result, setResult]   = useState(null);
  const [err, setErr]         = useState('');
  const [busy, setBusy]       = useState(false);
  const [paused, setPaused]   = useState(false);
  const [muted, setMuted]     = useState(false);
  const [online, setOnline]   = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [form, setForm]       = useState({ handle: '', email: '', consent: false });
  const signingUp = useRef(false);
  const roundId = useRef(null);

  const reducedMotion = useMemo(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    addEventListener('online', on); addEventListener('offline', off);
    return () => { removeEventListener('online', on); removeEventListener('offline', off); };
  }, []);

  const refreshBoard = useCallback(async id => {
    try {
      const data = await api.leaderboard(id);
      setBoard(data.board);setMe(data.me);setUpdatedAt(data.updatedAt);setContest(data.contest);
      setBoardStatus('ready');
    } catch {
      setBoardStatus(s => (s === 'ready' ? 'ready' : 'error'));
    }
  }, []);

  // Boot: real board first, then re-sync the stored player against the server.
  useEffect(() => {
    let alive = true;
    (async () => {
      // Account identity is authoritative. This also replaces a guest player
      // left in localStorage by somebody who used the device earlier.
      try {
        const account = await api.accountMe();
        const linked = await api.accountArcade(account.csrfToken);
        if (!alive) return;
        savePlayer(linked); setPlayer(linked); setAccountLinked(true);
        setAttempts(linked.attemptsLeft);setContest(linked.contest);
        if (linked.reward) onReward?.(linked.reward.code);
        await refreshBoard(linked.id);
        setScreen(linked.contest?.status==='open'?(linked.attemptsLeft>0?'ready':'spent'):'closed');
        return;
      } catch { /* No account session: continue with the guest identity. */ }

      const p = savedPlayer();
      await refreshBoard(p?.id);
      if (!alive) return;
      if (!p) { setScreen('signup'); return; }
      try {
        const status = await api.playerStatus(p.id,p.token);
        if (!alive) return;
        setAttempts(status.attemptsLeft);setContest(status.contest);
        if (status.reward) onReward?.(status.reward.code);
        setScreen(status.contest?.status==='open'?(status.attemptsLeft>0?'ready':'spent'):'closed');
      } catch {
        clearPlayer(); setPlayer(null); setScreen('signup');
      }
    })();
    return () => { alive = false; };
  }, [refreshBoard, onReward]);

  // Keep the board live while somebody is looking at it, never while playing
  // and never in a hidden tab.
  useEffect(() => {
    if (screen === 'playing') return;
    const id = setInterval(() => {
      if (!document.hidden && navigator.onLine) refreshBoard(savedPlayer()?.id);
    }, 25000);
    return () => clearInterval(id);
  }, [screen, refreshBoard]);

  const signup = async () => {
    /* setBusy is asynchronous, so rapid clicks in the same tick all see
       busy === false. A ref flips immediately and is the real guard. */
    if(signingUp.current) return;
    signingUp.current = true;
    setErr(''); setBusy(true);
    try {
      const p = await api.signup({
        handle: form.handle.trim(), email: form.email.trim(), consent: form.consent
      });
      savePlayer(p);setPlayer(p);setAttempts(p.attemptsLeft);setContest(p.contest);
      if (p.reward) onReward?.(p.reward.code);
      await refreshBoard(p.id);
      setScreen(p.contest?.status==='open'?(p.attemptsLeft>0?'ready':'spent'):'closed');
    } catch (e) {
      // The server returns a code; the wording is chosen here, per language.
      const key = NAME_MESSAGE[e.code];
      setErr(key ? t(key) : e.message);
    } finally { signingUp.current = false; setBusy(false); }
  };

  const start = () => {
    if(contest?.status!=='open'){toast(t('arcade.closed'),'!');return;}
    roundId.current = newRoundId();
    setPaused(false);
    setScreen('playing');
  };

  const finish = useCallback(async payload => {
    setScreen('submitting');
    try {
      const r = await api.submitScore({
        playerId: player.id, token: player.token, roundId: roundId.current, ...payload
      });
      setResult({ ...r, accuracy: payload.accuracy, hits: payload.hits });
      setAttempts(r.attemptsLeft);
      if(r.reward?.code)onReward?.(r.reward.code);
      if(r.contest)setContest(r.contest);
      await refreshBoard(player.id);
      if(r.rank<=5)toast(t('arcade.provisional',{rank:r.rank}),'★');
      setScreen('over');
    } catch (e) {
      toast(e.message, '!');
      setScreen(attempts > 0 ? 'ready' : 'spent');
    }
  }, [player, refreshBoard, toast, onReward, attempts, t]);

  const signOut = () => {
    clearPlayer(); setPlayer(null); setMe(null); setScreen('signup');
  };

  const tierLabel = result?.reward?.head
    || (me?.tier==='top1'?t('play.firstHead'):me?.tier==='top2'?'50% OFF':me?.tier==='top5'?'40% OFF':me?.tier==='played'?'10% OFF':null);

  // Before sign-up the reader is being offered three credits, not shown zero.
  const shownAttempts = player ? attempts : 3;
  const playing = screen === 'playing';
  const badge = contestBadge(contest);
  const meter = participantMeter(contest);
  const startable = canPlay(contest, attempts, screen);
  const registerable = canRegister(contest);
  const zone = rewardZone(me?.rank);
  const closed = closedState(contest, Boolean(player?.reward));
  const showSignup = screen === 'signup' && registerable;

  return (
    <section className="ark" id="play">
      {/* ---------------------------------------------------------- hero */}
      <header className="ark-hero">
        <SparkCore reduced={reducedMotion} />
        <span className="ark-hero-grid" aria-hidden="true" />
        <span className="ark-hero-scan" aria-hidden="true" />

        <div className="wrap ark-hero-in">
          <div className="ark-hero-top">
            <p className={`ark-badge is-${badge.tone}`}>
              <i aria-hidden="true" />{t(`ark.badge.${badge.key}`)}
            </p>
            {contest?.eventTitle && (
              <p className="ark-event">
                <span className="mono">{t('ark.playingFor')}</span>
                <b>{contest.eventTitle}</b>
              </p>
            )}
          </div>

          <h2 className="ark-title">{t('arcade.enter')}</h2>
          <p className="ark-statement">{t('ark.statement')}</p>
        </div>
      </header>

      {/* ------------------------------------------------- command panel */}
      <div className="wrap ark-command">
        {contest ? <>
          <div className="ark-command-clock">
            <span className="mono">{contest.assigned?t('ark.closesIn'):t('ark.awaitingSchedule')}</span>
            {contest.assigned?<Countdown contest={contest} t={t}/>:<p className="ark-unassigned">{t('ark.awaitingScheduleCopy')}</p>}
          </div>

          <div className="ark-command-charge">
            <div className={`ark-meter ${meter.reached ? 'is-full' : ''}`}>
              <div className="ark-meter-rail"><i style={{ '--fill': `${meter.percent}%` }} /></div>
              <b className="mono">{t('ark.qualified',{ count:meter.count, min:meter.min })}</b>
            </div>
            <p className="ark-meter-note">
              {meter.reached ? t('ark.chargeFull') : t('ark.needed',{ n:meter.needed })}
            </p>
          </div>

          <dl className="ark-command-stats">
            <div><dt>{t('ark.attempts')}</dt><dd>{shownAttempts}/3</dd></div>
            <div><dt>{t('ark.finalStatus')}</dt>
              <dd>{contest.status === 'finalized' ? t('ark.final')
                : contest.status === 'closed_pending' ? t('ark.pending') : t('ark.provisional')}</dd></div>
          </dl>
        </> : <p className="ark-empty-note">{t('ark.noEventCopy')}</p>}
      </div>

      {/* -------------------------------------------------- prize ladder */}
      <div className="wrap ark-ladder-wrap">
        <h3 className="ark-h3">{t('ark.ladder')}</h3>
        <ol className="ark-ladder">
          {LADDER.map(step => (
            <li key={step.key} className={`is-${step.key} ${zone === step.key ? 'is-yours' : ''}`}>
              <b className="ark-ladder-rank">{step.rank}</b>
              <span className="ark-ladder-who">{t(`ark.rankLabel${step.key === 'top1' ? '1' : step.key === 'top2' ? '2' : step.key === 'top5' ? '35' : 'Rest'}`)}</span>
              <i className="ark-ladder-prize">{t(`ark.rank${step.key === 'top1' ? '1' : step.key === 'top2' ? '2' : step.key === 'top5' ? '35' : 'Rest'}`)}</i>
            </li>
          ))}
        </ol>
        <p className="ark-ladder-lock">{t('ark.ladderLock')}</p>
      </div>

      {/* ------------------------------------------ registration or HUD */}
      {showSignup ? (
        <div className="wrap ark-card-slot">
          <form id="arcade-signup" className="ark-register" onSubmit={e => { e.preventDefault(); signup(); }}>
            <span className="ark-register-slot" aria-hidden="true" />
            <h3 className="ark-h3">{t('ark.registerTitle')}</h3>
            <p className="ark-register-copy">{t('ark.registerCopy')}</p>

            <label className="ark-field"><span>{t('play.name')}</span>
              <input value={form.handle} maxLength={18} autoComplete="nickname" required
                     placeholder={t('play.namePlaceholder')}
                     onChange={e => setForm(f => ({ ...f, handle: e.target.value }))} />
            </label>
            <label className="ark-field"><span>{t('contact.email')}</span>
              <input type="email" value={form.email} autoComplete="email" required
                     placeholder="you@email.com"
                     onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </label>
            <label className="ark-check">
              <input type="checkbox" checked={form.consent} required
                     onChange={e => setForm(f => ({ ...f, consent: e.target.checked }))} />
              <span>{t('play.consent')}</span>
            </label>

            {err && <p className="ark-err" role="alert">{err}</p>}
            <button className="btn btn-primary ark-insert" type="submit" disabled={busy}>
              {busy ? t('ark.registerBusy') : t('ark.registerCta')}
            </button>
          </form>
        </div>
      ) : player ? (
        <div className="wrap ark-card-slot">
          <div className="ark-hud">
            <div className="ark-hud-id">
              <span className="mono">{t('ark.hud')}</span>
              <b>{player.handle}</b>
            </div>
            <dl className="ark-hud-stats">
              <div><dt>{t('ark.best')}</dt><dd><Odometer value={me?.score || 0} /></dd></div>
              <div><dt>{t('ark.rank')}</dt><dd>{me?.rank ? pad(me.rank) : t('ark.unranked')}</dd></div>
              <div><dt>{t('ark.left')}</dt>
                <dd><span className="ark-credits" aria-hidden="true">
                  {[0,1,2].map(i => <i key={i} className={i < shownAttempts ? 'on' : ''} />)}
                </span>{shownAttempts}/3</dd></div>
              <div><dt>{t('ark.zone')}</dt>
                <dd className="ark-hud-zone">{zone ? t(`ark.rank${zone === 'top1' ? '1' : zone === 'top2' ? '2' : zone === 'top5' ? '35' : 'Rest'}`) : t('ark.noZone')}</dd></div>
            </dl>
            <p className={`ark-hud-state is-${contest?.status === 'finalized' ? 'final' : 'provisional'}`}>
              {contest?.status === 'finalized' ? t('ark.final') : t('ark.provisional')}
            </p>
          </div>
        </div>
      ) : null}

      {/* ------------------------------------------------- arena + board */}
      <div className="wrap ark-main">
        <div className="ark-arena">
          <div className={'ark-stage stage' + (playing ? ' is-live' : '')}>
            <span className="ark-rail is-left" aria-hidden="true" />
            <span className="ark-rail is-right" aria-hidden="true" />
            <SparkRush
              active={playing}
              paused={paused}
              muted={muted}
              reducedMotion={reducedMotion}
              onFinish={finish}
              onTogglePause={() => setPaused(p => !p)}
              onToggleSound={() => setMuted(m => !m)}
              labels={{
                score: t('play.score'), multiplier: t('play.multiplier'), time: t('play.time'),
                pause: t('arcade.pause'), resume: t('arcade.resume'), paused: t('arcade.paused'),
                soundOn: t('arcade.soundOn'), soundOff: t('arcade.soundOff')
              }}
            />

            <div className={'overlay' + (playing ? ' hidden' : '')}>
              <div className="overlay-in">
                {screen === 'loading' && <p className="mono">{t('play.loading')}</p>}
                {screen === 'submitting' && <p className="mono">{t('play.saving')}</p>}

                {screen === 'signup' && !registerable && (
                  <ClosedPanel closed={closed} contest={contest} t={t} onTickets={onTickets} />
                )}

                {screen === 'signup' && registerable && (
                  <>
                    <h3>{t('ark.registerTitle')}</h3>
                    <p>{t('ark.registerCopy')}</p>
                    <a className="btn btn-primary" href="#arcade-signup">{t('ark.registerCta')}</a>
                  </>
                )}

                {screen === 'ready' && (
                  <>
                    <h3>{t('arcade.attractHint')}</h3>
                    <p>{t('play.instructions')}</p>
                    <p className="mono arcade-credit-line">{player?.handle} · {attempts}/3 {t('arcade.today')}</p>
                    <button className="btn btn-primary" style={{ width:'100%' }}
                            onClick={start} disabled={!startable}>
                      {t('arcade.start')}
                    </button>
                  </>
                )}

                {screen === 'spent' && (
                  <>
                    <h3>{t('play.spent')}</h3>
                    <p>{t('play.spentCopy')}</p>
                    <button className="btn btn-ghost" style={{ marginTop:18 }} onClick={() => onTickets?.('next')}>
                      {t('play.use')}
                    </button>
                  </>
                )}

                {screen === 'closed' && <ClosedPanel closed={closed} contest={contest} t={t} onTickets={onTickets} />}

                {screen === 'over' && result && (
                  <>
                    <div className="hud-item"><span>{t('play.final')}</span></div>
                    <div className="score-big">{result.score.toLocaleString()}</div>
                    <div className="rank-line">
                      {t('arcade.rank')} {pad(result.rank)} · {t('arcade.targets')} {result.hits} ·
                      {' '}{t('arcade.accuracy')} {result.accuracy}%
                    </div>
                    {result.score >= result.bestScore && <p className="new-best mono">{t('arcade.newBest')}</p>}
                    <div className="reward">
                      <b>{result.reward.head}</b>
                      <p>{result.reward.sub}</p>
                      {result.reward.code && <button className="code" onClick={() => {
                        navigator.clipboard?.writeText(result.reward.code);
                        toast(result.reward.code, '★');
                      }}><span>{result.reward.code}</span><small>{t('common.copy')}</small></button>}
                    </div>
                    <div className="over-actions">
                      {attempts > 0 && (
                        <button className="btn btn-ghost" onClick={start}>{t('play.again',{count:attempts})}</button>
                      )}
                      {!result.reward.pending && (
                        <button className="btn btn-primary" onClick={() => onTickets?.(contest?.eventSlug || 'next')}>
                          {t('play.use')}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <Leaderboard
          board={board} me={me} status={boardStatus} online={online}
          updatedAt={updatedAt} onRetry={() => { setBoardStatus('loading'); refreshBoard(savedPlayer()?.id); }}
        />
      </div>

      {/* ------------------------------------------------------- legend */}
      <div className="wrap ark-legend-wrap">
        <h3 className="ark-h3">{t('ark.legend')}</h3>
        <ul className="ark-legend">
          {[['spark','Spark'],['ember','Ember'],['runner','Runner'],['dark','Dark'],['miss','Miss']].map(([key]) => (
            <li key={key}>
              <span className={`ark-pip is-${key}`} aria-hidden="true" />
              <b>{t(`ark.legend${key[0].toUpperCase()}${key.slice(1)}`)}</b>
              <i>{t(`ark.legend${key[0].toUpperCase()}${key.slice(1)}V`)}</i>
            </li>
          ))}
        </ul>
        <p className="ark-legend-note">{t('ark.legendSpeed')} {t('ark.legendCombo')}</p>
      </div>

      {player && !accountLinked && (
        <div className="wrap arcade-foot">
          <p className="mono">{t('play.season')}</p>
          <button className="linklike mono" onClick={signOut}>{t('play.signOut')}</button>
        </div>
      )}

      {/* A start action that follows the player on a phone — only while the
          competition is actually open and a credit remains. */}
      {startable && (
        <div className="ark-sticky">
          <button className="btn btn-primary" onClick={start}>{t('ark.startGame')}</button>
        </div>
      )}
    </section>
  );
}

/** The closed competition panel: says which kind of closed, and offers a way on. */
function ClosedPanel({ closed, contest, t, onTickets }){
  const copy = {
    awaiting_minimum: t('ark.awaitingCopy',{ n: contest?.entriesNeeded ?? 0 }),
    finalizing: t('ark.finalizingCopy'),
    finalized: t('ark.finalizedCopy'),
    finalized_reward: t('ark.finalizedRewardCopy'),
    closed: t('ark.finalizingCopy'),
    no_event: t('ark.noEventCopy')
  }[closed.key];

  return (
    <div className="ark-closed">
      <h3>{closed.key.startsWith('finalized') ? t('ark.finalizedTitle') : t('ark.closedTitle')}</h3>
      <p>{copy}</p>
      {closed.key === 'finalized_reward' && (
        <button className="btn btn-primary" onClick={() => onTickets?.(contest?.eventSlug || 'next')}>
          {t('play.use')}
        </button>
      )}
      {closed.action === 'final_board' && (
        <a className="btn btn-ghost" href="#board">{t('ark.finalBoard')}</a>
      )}
      {closed.action === 'next_competition' && (
        <a className="btn btn-ghost" href="/schedule">{t('ark.nextCompetition')}</a>
      )}
    </div>
  );
}

/** Countdown digits, redrawn every second from the contest close time. */
function Countdown({ contest, t }){
  const [ms, setMs] = useState(() => msUntilClose(contest));
  useEffect(() => {
    const tick = () => setMs(msUntilClose(contest));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [contest]);
  const p = countdownParts(ms);
  const cells = [[p.days, t('ark.days')], [p.hours, t('ark.hours')],
                 [p.minutes, t('ark.min')], [p.seconds, t('ark.sec')]];
  return (
    <div className="ark-clock">
      {cells.map(([value, label]) => (
        <b key={label}><span key={value}>{String(value).padStart(2,'0')}</span><i>{label}</i></b>
      ))}
    </div>
  );
}

/**
 * The reactor on the right of the hero. Canvas so the ember count costs nothing
 * in layout; it stops entirely when the tab is hidden or motion is reduced.
 */
function SparkCore({ reduced }){
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    if(!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, frame = 0, embers = [], t0 = 0, hidden = false;

    const fit = () => {
      const box = canvas.parentElement.getBoundingClientRect();
      w = box.width; h = box.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(46, Math.max(12, w / 34)));
      embers = Array.from({ length: count }, seed);
      if(reduced) draw(0);
    };
    const seed = () => ({
      a: Math.random() * Math.PI * 2, r: 40 + Math.random() * 190,
      s: 0.0012 + Math.random() * 0.0034, size: 0.7 + Math.random() * 1.9,
      hue: Math.random() < 0.3 ? 330 : 22
    });
    const draw = time => {
      ctx.clearRect(0, 0, w, h);
      const cx = w * 0.62, cy = h * 0.5;
      // The core.
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.42);
      glow.addColorStop(0, 'rgba(255,150,60,.55)');
      glow.addColorStop(0.4, 'rgba(255,92,26,.20)');
      glow.addColorStop(1, 'rgba(255,46,139,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      for(const e of embers){
        const a = e.a + (reduced ? 0 : time * e.s);
        const x = cx + Math.cos(a) * e.r, y = cy + Math.sin(a) * e.r * 0.62;
        ctx.globalAlpha = 0.5 + Math.sin(a * 2) * 0.3;
        ctx.fillStyle = `hsl(${e.hue} 100% ${e.hue === 330 ? 64 : 58}%)`;
        ctx.beginPath(); ctx.arc(x, y, e.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    const loop = time => {
      if(!t0) t0 = time;
      draw(time - t0);
      frame = requestAnimationFrame(loop);
    };
    const onVisibility = () => {
      hidden = document.hidden;
      cancelAnimationFrame(frame);
      if(!hidden && !reduced) frame = requestAnimationFrame(loop);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas.parentElement);
    document.addEventListener('visibilitychange', onVisibility);
    if(!reduced) frame = requestAnimationFrame(loop); else draw(0);

    return () => {
      cancelAnimationFrame(frame); ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reduced]);
  return <canvas ref={ref} className="ark-core" aria-hidden="true" />;
}
