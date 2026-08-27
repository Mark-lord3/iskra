import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SparkRush, { ROUND } from './SparkRush.jsx';
import Leaderboard from './Leaderboard.jsx';
import MeltText from './MeltText.jsx';
import { api, savedPlayer, savePlayer, clearPlayer } from '../api.js';
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
        const status = await api.playerStatus(p.id);
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
    } finally { setBusy(false); }
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
  const topThree = board.slice(0, 3);
  const playing = screen === 'playing';

  return (
    <section className="section arcade" id="play">
      {/* ---------- entrance ---------- */}
      <div className="wrap arcade-entrance">
        <div className="arcade-title-block">
          <p className="arcade-kicker mono">{t('play.eyebrow')}</p>
          <MeltText as="h2" className="arcade-title h-xl">{t('arcade.enter')}</MeltText>
          <p className="lead arcade-sub">{t('arcade.subtitle')}</p>
          <ContestWindow contest={contest} t={t}/>

          <div className="arcade-actions">
            {screen === 'signup' ? (
              <a className="btn btn-primary btn-lg" href="#arcade-signup">{t('arcade.insert')}</a>
            ) : (
              <button className="btn btn-primary btn-lg" disabled={contest?.status!=='open'||attempts<=0||playing} onClick={start}>
                {t('arcade.start')}
              </button>
            )}
            <div className="arcade-credits">
              <span className="mono">{t('arcade.credits')}</span>
              <span className="credit-dots" aria-hidden="true">
                {[0,1,2].map(i => <i key={i} className={i < shownAttempts ? 'on' : ''} />)}
              </span>
              <b className="mono">{shownAttempts}/3 {t('arcade.today')}</b>
            </div>
          </div>
        </div>

        <div className="arcade-readout">
          <div className="readout-cell">
            <span className="mono">{t('arcade.reward')}</span>
            <b>{tierLabel || t('arcade.noReward')}</b>
          </div>
          <div className="readout-cell num">
            <span className="mono">{t('play.score')}</span>
            <Odometer value={me?.score || 0} />
          </div>
          <div className="readout-cell num">
            <span className="mono">{t('arcade.rank')}</span>
            <b>{me?.rank ? pad(me.rank) : '--'}</b>
          </div>
          <ol className="readout-top" aria-label={t('arcade.liveBoard')}>
            {topThree.map(row => (
              <li key={row.id}><span className="mono">{pad(row.rank)}</span>
                <em>{row.handle}</em><b>{row.score.toLocaleString()}</b></li>
            ))}
            {boardStatus === 'ready' && topThree.length === 0 && (
              <li className="readout-empty">{t('arcade.boardEmpty')}</li>
            )}
          </ol>
        </div>
      </div>

      {/* ---------- arena ---------- */}
      <div className="wrap arcade-stage-grid">
        <div className="arena-col">
          <div className={'stage' + (playing ? ' is-live' : '')}>
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

                {screen === 'signup' && (
                  <form id="arcade-signup" onSubmit={e => { e.preventDefault(); signup(); }}>
                    <h3>{t('play.cheap')}</h3>
                    <p>{t('play.signupCopy')}</p>
                    <label className="field"><span>{t('play.name')}</span>
                      <input value={form.handle} maxLength={18} autoComplete="nickname" required
                             placeholder={t('play.namePlaceholder')}
                             onChange={e => setForm(f => ({ ...f, handle: e.target.value }))} />
                    </label>
                    <label className="field"><span>{t('contact.email')}</span>
                      <input type="email" value={form.email} autoComplete="email" required
                             placeholder="you@email.com"
                             onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                    </label>
                    <label className="checkline">
                      <input type="checkbox" checked={form.consent} required
                             onChange={e => setForm(f => ({ ...f, consent: e.target.checked }))} />
                      <span>{t('play.consent')}</span>
                    </label>
                    <div className="err" role="alert">{err}</div>
                    <button className="btn btn-primary" type="submit" style={{ width: '100%' }} disabled={busy}>
                      {busy ? t('arcade.checking') : t('play.enter')}
                    </button>
                  </form>
                )}

                {screen === 'ready' && (
                  <>
                    <h3>{t('arcade.attractHint')}</h3>
                    <p>{t('play.instructions')}</p>
                    <p className="mono arcade-credit-line">
                      {player?.handle} · {attempts}/3 {t('arcade.today')}
                    </p>
                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={start}>
                      {t('arcade.start')}
                    </button>
                  </>
                )}

                {screen === 'spent' && (
                  <>
                    <h3>{t('play.spent')}</h3>
                    <p>{t('play.spentCopy')}</p>
                    <button className="btn btn-ghost" style={{ marginTop: 18 }} onClick={() => onTickets?.('next')}>
                      {t('play.use')}
                    </button>
                  </>
                )}

                {screen==='closed'&&<>
                  <h3>{contest?.status==='finalized'?t('arcade.finalized'):t('arcade.closed')}</h3>
                  <p>{contest?.status==='closed_pending'?t('arcade.awaitingMinimum',{count:contest.entriesNeeded}):t('arcade.closedCopy')}</p>
                  {player?.reward&&<button className="btn btn-primary" onClick={()=>onTickets?.(contest?.eventSlug)}>{t('play.use')}</button>}
                </>}

                {screen === 'over' && result && (
                  <>
                    <div className="hud-item"><span>{t('play.final')}</span></div>
                    <div className="score-big">{result.score.toLocaleString()}</div>
                    <div className="rank-line">
                      {t('arcade.rank')} {pad(result.rank)} · {t('arcade.targets')} {result.hits} ·
                      {' '}{t('arcade.accuracy')} {result.accuracy}%
                    </div>
                    {result.score >= result.bestScore && (
                      <p className="new-best mono">{t('arcade.newBest')}</p>
                    )}
                    <div className="reward">
                      <b>{result.reward.head}</b>
                      <p>{result.reward.sub}</p>
                      {result.reward.code&&<button className="code" onClick={() => {
                        navigator.clipboard?.writeText(result.reward.code);
                        toast(result.reward.code, '★');
                      }}><span>{result.reward.code}</span><small>{t('common.copy')}</small></button>}
                    </div>
                    <div className="over-actions">
                      {attempts > 0 && (
                        <button className="btn btn-ghost" onClick={start}>
                          {t('play.again')} ({attempts})
                        </button>
                      )}
                      {!result.reward.pending&&<button className="btn btn-primary" onClick={() => onTickets?.(contest?.eventSlug||'next')}>{t('play.use')}</button>}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <p className="gamehint mono">
            <span>{t('play.orange')}</span><span>{t('play.pale')}</span>
            <span>{t('play.dark')}</span><span>{t('play.miss')}</span>
          </p>
        </div>

        <Leaderboard
          board={board} me={me} status={boardStatus} online={online}
          updatedAt={updatedAt} onRetry={() => { setBoardStatus('loading'); refreshBoard(savedPlayer()?.id); }}
        />
      </div>

      {player && !accountLinked && (
        <div className="wrap arcade-foot">
          <p className="mono">{t('play.season')}</p>
          <button className="linklike mono" onClick={signOut}>{t('play.signOut')}</button>
        </div>
      )}
    </section>
  );
}
