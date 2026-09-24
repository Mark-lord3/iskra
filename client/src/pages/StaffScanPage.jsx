import TicketCategory from '../components/TicketCategory.jsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

const TOKEN_KEY = 'iskra_scanner_token';
const SHIFT_KEY = 'iskra_scanner_shift';
const HOLD_MS = 2600;          // how long a result stays before scanning resumes

/* Wording and treatment for every outcome the door API can return. */
const OUTCOME = {
  admitted:    { tone:'ok',    title:'ENTRY APPROVED', mark:'✓' },
  already_used:{ tone:'used',  title:'ALREADY USED',   mark:'✕' },
  invalid:     { tone:'bad',   title:'INVALID TICKET', mark:'✕' },
  cancelled:   { tone:'bad',   title:'CANCELLED',      mark:'✕' },
  expired:     { tone:'bad',   title:'EXPIRED',        mark:'✕' },
  wrong_event: { tone:'bad',   title:'WRONG NIGHT',    mark:'✕' },
  unpaid:      { tone:'bad',   title:'NOT PAID',       mark:'✕' },
  reservation_only:{ tone:'warn', title:'VIP RESERVATION', mark:'!' },
  offline:     { tone:'warn',  title:'NO CONNECTION',  mark:'!' },
  error:       { tone:'warn',  title:'CHECK FAILED',   mark:'!' }
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const readShift = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(SHIFT_KEY) || '{}');
    return raw.day === todayKey() ? raw.count || 0 : 0;
  } catch { return 0; }
};

export default function StaffScanPage() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [session, setSession] = useState(null);
  const [gate, setGate] = useState('checking');    // checking | needs-invite | ready | denied
  const [gateNote, setGateNote] = useState('');
  const [camera, setCamera] = useState('starting'); // starting | live | denied | none | insecure | paused
  const [result, setResult] = useState(null);
  const [shift, setShift] = useState(readShift);
  const [torchOn, setTorchOn] = useState(false);
  const [torchable, setTorchable] = useState(false);
  const [manual, setManual] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [sound, setSound] = useState(true);
  const [passcode, setPasscode] = useState('');
  const [passError, setPassError] = useState('');
  const [passBusy, setPassBusy] = useState(false);

  const scannerRef = useRef(null);
  const camerasRef = useRef([]);
  const camIndexRef = useRef(0);
  const busyRef = useRef(false);        // blocks repeat reads while a request is open
  const lastCodeRef = useRef('');
  const holdRef = useRef(0);
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  /* ---------------------------------------------------------- feedback */
  const buzz = ms => { try { navigator.vibrate?.(ms); } catch { /* unsupported */ } };
  const beep = useCallback((freq, dur = 0.12) => {
    if (!sound) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g).connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + dur);
      setTimeout(() => ctx.close().catch(() => {}), 400);
    } catch { /* audio unavailable */ }
  }, [sound]);

  /* ---------------------------------------------------------- session */
  useEffect(() => {
    let alive = true;
    (async () => {
      const url = new URL(location.href);
      const invite = url.searchParams.get('invite');
      if (invite) {
        try {
          const s = await api.staffSession(invite);
          if (!alive) return;
          localStorage.setItem(TOKEN_KEY, s.token);
          setToken(s.token); setSession(s); setGate('ready');
          history.replaceState({}, '', '/staff/scan');   // the invite never lingers in the URL
          return;
        } catch (e) {
          if (!alive) return;
          setGate('needs-invite'); setGateNote(e.message);
          return;
        }
      }
      const saved = localStorage.getItem(TOKEN_KEY);
      if (!saved) { setGate('needs-invite'); return; }
      try {
        const me = await api.staffMe(saved);
        if (!alive) return;
        setSession(me); setGate('ready');
      } catch (e) {
        if (!alive) return;
        localStorage.removeItem(TOKEN_KEY); setToken('');
        setGate('denied');
        setGateNote(e.code === 'REVOKED' ? 'This device was revoked by an administrator.'
                  : e.code === 'EXPIRED' ? 'This device session has expired.'
                  : e.message);
      }
    })();
    return () => { alive = false; };
  }, []);

  const signInWithPasscode = async e => {
    e.preventDefault();
    if (passBusy) return;
    setPassBusy(true); setPassError('');
    try {
      const s = await api.staffPasscode(passcode.trim());
      localStorage.setItem(TOKEN_KEY, s.token);
      setToken(s.token); setSession(s); setGate('ready');
    } catch (err) {
      setPassError(err.code === 'NO_PASSCODE'
        ? 'Passcode sign-in is switched off. Ask for a scanner link.'
        : 'That passcode is not correct.');
    } finally { setPassBusy(false); }
  };

  /* ---------------------------------------------------------- decisions */
  const handleCode = useCallback(async raw => {
    const code = String(raw || '').trim();
    if (!code || busyRef.current) return;
    // Ignore an immediate re-read of the same QR still in frame.
    if (code === lastCodeRef.current && Date.now() < holdRef.current) return;
    busyRef.current = true;
    lastCodeRef.current = code;

    try {
      const res = await api.staffRedeem(tokenRef.current, code);
      setResult({ ...res, at: new Date() });
      if (res.outcome === 'admitted') {
        buzz(60); beep(1320);
        setShift(n => {
          const next = n + 1;
          try { localStorage.setItem(SHIFT_KEY, JSON.stringify({ day: todayKey(), count: next })); } catch {}
          return next;
        });
      } else { buzz([40, 60, 40]); beep(280, 0.22); }
    } catch (e) {
      // A failed request must never read as an admission.
      if (e.status === 401 || e.status === 403) {
        localStorage.removeItem(TOKEN_KEY); setToken('');
        setGate('denied');
        setGateNote(e.code === 'REVOKED' ? 'This device was revoked by an administrator.'
                  : 'This device session is no longer valid.');
        return;
      }
      const offline = !navigator.onLine || e.code === 'NETWORK_ERROR' || e.code === 'TIMEOUT';
      setResult({
        outcome: offline ? 'offline' : (e.outcome || 'error'),
        error: e.message, ticket: e.ticket || null, at: new Date(), retryCode: code
      });
      buzz([40, 60, 40]); beep(280, 0.22);
    } finally {
      holdRef.current = Date.now() + HOLD_MS;
      busyRef.current = false;
    }
  }, [beep]);

  // Results clear themselves so the next guest can step up without a tap.
  useEffect(() => {
    if (!result) return;
    if (result.outcome === 'offline' || result.outcome === 'error') return;  // needs a decision
    const id = setTimeout(() => setResult(null), HOLD_MS);
    return () => clearTimeout(id);
  }, [result]);

  /* ---------------------------------------------------------- camera */
  const startCamera = useCallback(async () => {
    if (gate !== 'ready') return;
    if (!window.isSecureContext) { setCamera('insecure'); return; }
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const cams = await Html5Qrcode.getCameras();
      if (!cams.length) { setCamera('none'); return; }
      camerasRef.current = cams;
      // Prefer the rear camera: it is what a door device points at a guest.
      const rear = cams.findIndex(c => /back|rear|environment/i.test(c.label));
      camIndexRef.current = rear >= 0 ? rear : cams.length - 1;

      const scanner = new Html5Qrcode('door-camera', { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { deviceId: { exact: cams[camIndexRef.current].id } },
        { fps: 12, qrbox: { width: 260, height: 260 }, aspectRatio: 1.0 },
        text => handleCode(text),
        () => {}
      );
      setCamera('live');
      const caps = scanner.getRunningTrackCapabilities?.() || {};
      setTorchable(!!caps.torch);
    } catch (e) {
      const denied = /permission|denied|NotAllowed/i.test(e?.message || '');
      setCamera(denied ? 'denied' : 'none');
    }
  }, [gate, handleCode]);

  useEffect(() => { if (gate === 'ready') startCamera(); }, [gate, startCamera]);
  useEffect(() => () => { scannerRef.current?.stop().catch(() => {}); }, []);

  const toggleTorch = async () => {
    try {
      await scannerRef.current?.applyVideoConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn(v => !v);
    } catch { setTorchable(false); }
  };

  const switchCamera = async () => {
    const cams = camerasRef.current;
    if (cams.length < 2) return;
    camIndexRef.current = (camIndexRef.current + 1) % cams.length;
    try {
      await scannerRef.current?.stop();
      await scannerRef.current?.start(
        { deviceId: { exact: cams[camIndexRef.current].id } },
        { fps: 12, qrbox: { width: 260, height: 260 }, aspectRatio: 1.0 },
        text => handleCode(text), () => {}
      );
      setCamera('live');
    } catch { setCamera('none'); }
  };

  const togglePause = async () => {
    const s = scannerRef.current;
    if (!s) return;
    if (camera === 'paused') { try { s.resume(); setCamera('live'); } catch { startCamera(); } }
    else { try { s.pause(true); setCamera('paused'); } catch {} }
  };

  /* ---------------------------------------------------------- gates */
  if (gate === 'checking') {
    return <main className="door door-plain"><p className="door-note mono">Checking device…</p></main>;
  }
  if (gate === 'needs-invite' || gate === 'denied') {
    return (
      <main className="door door-plain">
        <div className="door-gate">
          <p className="door-kicker mono">ISKRA door</p>
          <h1>Device not authorised</h1>
          <p className="door-note">
            {gateNote || 'Ask an administrator for a scanner link. It opens this page and authorises this phone.'}
          </p>
          <form className="door-pass" onSubmit={signInWithPasscode}>
            <label htmlFor="door-pass">Staff passcode</label>
            <input id="door-pass" type="password" inputMode="numeric" autoComplete="one-time-code"
                   value={passcode} onChange={e => { setPasscode(e.target.value); setPassError(''); }}
                   aria-invalid={!!passError} aria-describedby={passError ? 'door-pass-err' : undefined} />
            {passError && <p id="door-pass-err" className="door-pass-err" role="alert">{passError}</p>}
            <button className="door-btn" type="submit" disabled={passBusy}>
              {passBusy ? 'Checking…' : 'Open scanner'}
            </button>
          </form>
          <p className="door-note dim mono">This scanner only checks tickets. It has no access to the admin dashboard.</p>
        </div>
      </main>
    );
  }

  const info = result ? (OUTCOME[result.outcome] || OUTCOME.error) : null;
  const access = result?.ticket?.access || null;
  const vipLabel = access?.vipReservationOnly
    ? 'Reservation only, no guest admitted'
    : access?.vipIncluded
      ? `${access.vipTables || 1} VIP ${access.vipTables === 1 ? 'table' : 'tables'} included`
      : 'No VIP attached';

  return (
    <main className={'door' + (info ? ` door-flash tone-${info.tone}` : '')}>
      {/* ---- top bar ---- */}
      <header className="door-bar">
        <div className="door-id">
          <span className="door-dot" aria-hidden="true" />
          <span className="mono">{session?.label || 'Door'}</span>
        </div>
        <p className="door-shift mono" aria-live="off">
          <span>IN</span><b>{shift}</b>
        </p>
      </header>

      {/* ---- camera ---- */}
      <section className="door-stage">
        <div id="door-camera" className="door-camera" />

        {camera === 'live' && (
          <div className="door-frame" aria-hidden="true">
            <i className="c tl" /><i className="c tr" /><i className="c bl" /><i className="c br" />
            <span className="door-scanline" />
          </div>
        )}

        {camera !== 'live' && camera !== 'paused' && (
          <div className="door-camera-state">
            <p className="door-state-title">
              {camera === 'starting' ? 'Starting camera…'
                : camera === 'denied' ? 'Camera blocked'
                : camera === 'insecure' ? 'HTTPS required'
                : 'No camera found'}
            </p>
            <p className="door-note">
              {camera === 'denied' ? 'Allow camera access in the browser settings, then reload.'
                : camera === 'insecure' ? 'Open this page over HTTPS to use the camera.'
                : camera === 'starting' ? 'Point the rear camera at the guest ticket.'
                : 'Use manual entry below.'}
            </p>
            {camera !== 'starting' && (
              <button className="door-btn" onClick={startCamera}>Retry camera</button>
            )}
          </div>
        )}

        {camera === 'paused' && <div className="door-camera-state"><p className="door-state-title">Paused</p></div>}

        <p className="door-hint mono">Hold the guest QR inside the frame</p>
      </section>

      {/* ---- controls ---- */}
      <nav className="door-tools" aria-label="Scanner controls">
        <button className="door-tool" onClick={togglePause} aria-pressed={camera === 'paused'}>
          <span aria-hidden="true">{camera === 'paused' ? '▶' : '❙❙'}</span>
          {camera === 'paused' ? 'Resume' : 'Pause'}
        </button>
        <button className="door-tool" onClick={toggleTorch} disabled={!torchable} aria-pressed={torchOn}>
          <span aria-hidden="true">✺</span>Light
        </button>
        <button className="door-tool" onClick={switchCamera} disabled={camerasRef.current.length < 2}>
          <span aria-hidden="true">⇄</span>Camera
        </button>
        <button className="door-tool" onClick={() => setSound(s => !s)} aria-pressed={sound}>
          <span aria-hidden="true">{sound ? '◉' : '◌'}</span>Sound
        </button>
        <button className="door-tool" onClick={() => setShowManual(v => !v)} aria-expanded={showManual}>
          <span aria-hidden="true">⌨</span>Code
        </button>
      </nav>

      {showManual && (
        <form className="door-manual" onSubmit={e => { e.preventDefault(); handleCode(manual); setManual(''); }}>
          <label className="sr-only" htmlFor="door-code">Ticket reference</label>
          <input id="door-code" value={manual} onChange={e => setManual(e.target.value)}
                 placeholder="ISKRA-XXXXXXXX" autoComplete="off" autoCapitalize="characters" />
          <button className="door-btn" type="submit">Check</button>
        </form>
      )}

      {/* ---- result ---- */}
      <div className="door-live" role="status" aria-live="assertive">
        {result && `${info.title}. ${result.ticket?.guest || ''} ${result.error || ''}`}
      </div>

      {result && (
        <section className={`door-result tone-${info.tone}`}>
          <p className="door-result-mark" aria-hidden="true">{info.mark}</p>
          <h2 className="door-result-title">{info.title}</h2>

          {result.ticket && (
            <dl className="door-facts">
              <div><dt>Guest</dt><dd>{result.ticket.guest}</dd></div>
              <div><dt>Ticket</dt><dd>{result.ticket.tier}<TicketCategory ticket={result.ticket}/></dd></div>
              <div><dt>Night</dt><dd>{result.ticket.eventTitle}</dd></div>
              <div><dt>Ref</dt><dd className="mono">{result.ticket.reference}</dd></div>
              <div><dt>Admits</dt><dd>{access?.admits || 0} guest{access?.admits === 1 ? '' : 's'}</dd></div>
              <div><dt>Order</dt><dd>{access ? `${access.admitted} / ${access.orderAdmissions} used` : '1 / 1 used'}</dd></div>
              <div><dt>Remaining valid tickets</dt><dd>{access?.remaining || 0}</dd></div>
              {access?.cancelled>0&&<div><dt>Cancelled tickets</dt><dd>{access.cancelled}</dd></div>}
              <div><dt>VIP</dt><dd>{vipLabel}</dd></div>
            </dl>
          )}

          {result.outcome === 'admitted' && (
            <p className="door-time mono">Scanned {result.at.toLocaleTimeString()}</p>
          )}
          {result.outcome === 'already_used' && result.ticket?.redeemedAt && (
            <p className="door-time mono">First used {new Date(result.ticket.redeemedAt).toLocaleString()}</p>
          )}
          {(result.outcome === 'offline' || result.outcome === 'error') && (
            <>
              <p className="door-note">{result.error} This ticket was not admitted.</p>
              <div className="door-retry">
                <button className="door-btn" onClick={() => { const c = result.retryCode; setResult(null); handleCode(c); }}>
                  Retry
                </button>
                <button className="door-btn ghost" onClick={() => setResult(null)}>Dismiss</button>
              </div>
            </>
          )}
          {!['offline','error','admitted'].includes(result.outcome) && result.error && (
            <p className="door-note">{result.error}</p>
          )}
        </section>
      )}
    </main>
  );
}
