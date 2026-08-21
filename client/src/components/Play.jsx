import { useCallback, useEffect, useState } from 'react';
import SparkRush from './SparkRush.jsx';
import Leaderboard from './Leaderboard.jsx';
import { api, savedPlayer, savePlayer, clearPlayer } from '../api.js';
import { useToast } from './Toasts.jsx';
import { pad } from '../utils.js';

const PRIZES = [
  { rank: 'First place',   head: '10 dollar ticket', text: 'Any single night this season, any tier. Transferable once.' },
  { rank: 'Second to fifth', head: 'Half price',     text: 'Fifty percent off up to two tickets to the night you pick.' },
  { rank: 'Everyone else', head: 'Ten percent off',  text: 'For turning up and playing. One code per sign-up.' }
];

export default function Play({ onTickets, onReward }) {
  const toast = useToast();
  const [player, setPlayer] = useState(savedPlayer);
  const [screen, setScreen] = useState('loading');
  const [board, setBoard] = useState([]);
  const [me, setMe] = useState(null);
  const [attempts, setAttempts] = useState(3);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ handle: '', email: '', consent: false });

  const refreshBoard = useCallback(async id => {
    try {
      const { board, me } = await api.leaderboard(id);
      setBoard(board); setMe(me);
    } catch { /* keep the last known board */ }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const p = savedPlayer();
      await refreshBoard(p?.id);
      if (!alive) return;
      if (!p) { setScreen('signup'); return; }
      try {
        const status = await api.playerStatus(p.id);
        if (!alive) return;
        setAttempts(status.attemptsLeft);
        if (status.reward) onReward(status.reward.code);
        setScreen(status.attemptsLeft > 0 ? 'start' : 'spent');
      } catch {
        clearPlayer(); setPlayer(null); setScreen('signup');
      }
    })();
    return () => { alive = false; };
  }, [refreshBoard, onReward]);

  // Keep the board fresh while somebody is looking at it, without polling
  // in the background when the tab is hidden.
  useEffect(() => {
    if (screen === 'playing') return;
    const id = setInterval(() => {
      if (!document.hidden) refreshBoard(savedPlayer()?.id);
    }, 30000);
    return () => clearInterval(id);
  }, [screen, refreshBoard]);

  const signup = async () => {
    setErr(''); setBusy(true);
    try {
      const p = await api.signup({ handle: form.handle.trim(), email: form.email.trim(), consent: form.consent });
      savePlayer(p); setPlayer(p); setAttempts(p.attemptsLeft);
      if (p.reward) onReward(p.reward.code);
      await refreshBoard(p.id);
      toast(`Welcome, <b>${p.handle}</b>. ${p.attemptsLeft} attempts loaded.`, '✦');
      setScreen(p.attemptsLeft > 0 ? 'start' : 'spent');
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const finish = useCallback(async payload => {
    setScreen('submitting');
    try {
      const r = await api.submitScore({ playerId: player.id, token: player.token, ...payload });
      setResult(r); setAttempts(r.attemptsLeft);
      onReward(r.reward.code);
      await refreshBoard(player.id);
      if (r.rank <= 5) toast(`Rank ${r.rank}. You are in the prize zone.`, '✦');
      setScreen('over');
    } catch (e) {
      toast(e.message, '!');
      setScreen(attempts > 0 ? 'start' : 'spent');
    }
  }, [player, refreshBoard, toast, onReward, attempts]);

  const signOut = () => {
    clearPlayer(); setPlayer(null); setScreen('signup'); setMe(null);
    toast('Signed out on this device', '✦');
  };

  return (
    <section className="section play" id="play">
      <div className="wrap">
        <div className="sec-head sec-bar">
          <div>
            <h2 className="h-lg rv">Play for tickets</h2>
            <p className="lead rv">
              Sixty seconds of Spark Rush. Catch the embers before they burn out, keep the
              multiplier alive, and the five highest scores of the season walk in cheap.
            </p>
          </div>
        </div>

        <div className="prizes rv">
          {PRIZES.map(p => (
            <div className="prize" key={p.rank}>
              <span>{p.rank}</span><b>{p.head}</b><p>{p.text}</p>
            </div>
          ))}
        </div>

        <div className="play-grid">
          <div>
            <div className="stage rv">
              <SparkRush active={screen === 'playing'} onFinish={finish} />

              <div className={'overlay' + (screen === 'playing' ? ' hidden' : '')}>
                <div className="overlay-in">

                  {screen === 'loading' && <p className="mono">Loading the board</p>}
                  {screen === 'submitting' && <p className="mono">Saving your score</p>}

                  {screen === 'signup' && (
                    <>
                      <h3>Play for<br />cheap tickets</h3>
                      <p>Sign up, take your three shots, land in the top five.</p>
                      <label className="field"><span>Display name</span>
                        <input value={form.handle} maxLength={18} autoComplete="nickname"
                               placeholder="How the board should know you"
                               onChange={e => setForm(f => ({ ...f, handle: e.target.value }))} />
                      </label>
                      <label className="field"><span>Email</span>
                        <input type="email" value={form.email} autoComplete="email" placeholder="you@email.com"
                               onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                               onKeyDown={e => e.key === 'Enter' && signup()} />
                      </label>
                      <label className="checkline">
                        <input type="checkbox" checked={form.consent}
                               onChange={e => setForm(f => ({ ...f, consent: e.target.checked }))} />
                        <span>I am 18 or over and I want lineup news and my prize code by email.</span>
                      </label>
                      <div className="err">{err}</div>
                      <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy} onClick={signup}>
                        {busy ? 'Checking' : 'Enter the leaderboard'}
                      </button>
                    </>
                  )}

                  {screen === 'start' && (
                    <>
                      <h3>Spark Rush</h3>
                      <p>Catch the orange embers before they burn out. The pale ones pay triple,
                         the dark ones cost you. Chain hits to build the multiplier.</p>
                      <p className="mono" style={{ fontSize: 11, marginTop: 16, color: 'var(--dim)' }}>
                        {player?.handle}, {attempts} attempt{attempts === 1 ? '' : 's'} left today
                      </p>
                      <button className="btn btn-primary" style={{ width: '100%', marginTop: 20 }}
                              onClick={() => setScreen('playing')}>Start round</button>
                    </>
                  )}

                  {screen === 'spent' && (
                    <>
                      <h3>Out of attempts</h3>
                      <p>You have used all three shots today, {player?.handle}. The board resets at
                         midnight, so come back and take another run at it.</p>
                      <a className="btn btn-ghost" style={{ marginTop: 20 }} href="/offers">
                        See other offers
                      </a>
                    </>
                  )}

                  {screen === 'over' && result && (
                    <>
                      <div className="hud-item">Final score</div>
                      <div className="score-big">{result.score.toLocaleString()}</div>
                      <div className="rank-line">
                        Rank {pad(result.rank)}, best {result.bestScore.toLocaleString()}
                      </div>
                      <div className="reward">
                        <b>{result.reward.head}</b>
                        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{result.reward.sub}</p>
                        <button className="code" style={{ width: '100%', justifyContent: 'space-between' }}
                                onClick={() => { navigator.clipboard?.writeText(result.reward.code);
                                                 toast(`Code <b>${result.reward.code}</b> copied`, '✦'); }}>
                          <span>{result.reward.code}</span><small>Copy</small>
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                        {attempts > 0 && (
                          <button className="btn btn-ghost" style={{ flex: 1 }}
                                  onClick={() => setScreen('start')}>Again ({attempts})</button>
                        )}
                        <button className="btn btn-primary" style={{ flex: 1 }}
                                onClick={() => onTickets('next')}>Use my code</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="gamehint">
              <span>Orange, 100 points</span>
              <span>Pale, triple</span>
              <span>Dark, penalty</span>
              <span>Missing resets the multiplier</span>
            </div>
          </div>

          <Leaderboard board={board} me={me} attemptsLeft={attempts}
                       hasPlayer={!!player} onReset={signOut} />
        </div>
      </div>
    </section>
  );
}
