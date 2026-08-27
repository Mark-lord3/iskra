import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { useReducedMotion, usePageVisible } from '../hooks/useMotionPrefs.js';
import { clockOffset, remaining, countdownParts, pad2,
         lobbyStatus, primaryAction, capacityMeter } from '../poker/lobby.js';

/**
 * The tournament control room.
 *
 * One polled endpoint feeds every panel, so the field counts, the table map,
 * the bracket, the chip leaderboard and the activity feed always describe the
 * same instant. The server states its own clock with each payload and every
 * countdown is drawn against that, never against the device.
 */
const POLL_LIVE_MS = 5000;
const POLL_IDLE_MS = 15000;

export default function TournamentLobby({ slug, onDemo }){
  const { t, formatDate } = useI18n();
  const reduced = useReducedMotion();
  const visible = usePageVisible();

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const offsetRef = useRef(0);
  const inFlight = useRef(false);

  /* ---- polling ---------------------------------------------------------- */
  const load = useCallback(async ({ quiet = false } = {}) => {
    if(!slug) return;
    try {
      const next = await api.pokerLobby(slug);
      offsetRef.current = clockOffset(next.serverTime);
      setData(next);
      setOffline(false);
      if(!quiet) setError('');
    } catch(err){
      // A poll that fails leaves the last good view on screen and says so,
      // rather than blanking the page.
      if(err?.code === 'NOT_FOUND'){ setError(err.message); setData(null); }
      else setOffline(true);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if(!visible) return;                       // a hidden tab does not poll
    const live = ['round_one','round_two','final_round','registration_open']
      .includes(data?.tournament?.state);
    const timer = setInterval(() => load({ quiet:true }), live ? POLL_LIVE_MS : POLL_IDLE_MS);
    return () => clearInterval(timer);
  }, [load, visible, data?.tournament?.state]);

  // Coming back to the tab re-syncs immediately rather than waiting for a tick.
  useEffect(() => { if(visible) load({ quiet:true }); }, [visible, load]);

  /* ---- the one action --------------------------------------------------- */
  const tournament = data?.tournament;
  const me = data?.me;
  const action = useMemo(() => primaryAction(me, tournament && {
    ...tournament,
    full: Boolean(data?.field?.capacity && data.field.registered >= data.field.capacity)
  }), [me, tournament, data?.field]);

  const run = useCallback(async kind => {
    // One request at a time: a second click while the first is unanswered is
    // dropped rather than sent, so a double tap cannot register twice.
    if(inFlight.current) return;
    inFlight.current = true;
    setBusy(kind); setError(''); setNotice('');
    try {
      const account = await api.accountMe();
      if(kind === 'register'){
        const detail = await api.pokerTournament(slug, 'en');
        await api.pokerRegister(tournament.id, account.csrfToken, {
          // The account already knows who this is; nothing is asked twice.
          displayName: (me?.displayName || account.user.name || 'PLAYER').slice(0, 18),
          confirmAge: true,
          rulesVersion: detail.rulesVersionId,
          marketingConsent: false
        });
      }
      if(kind === 'check-in') await api.pokerCheckIn(tournament.id, account.csrfToken);
      await load();
      setNotice(t(`lob.act.${kind === 'register' ? 'registered' : 'registered'}`));
    } catch(err){
      setError(friendly(err, t));
    } finally {
      inFlight.current = false;
      setBusy('');
    }
  }, [slug, tournament, me, load, t]);

  if(error && !data) return (
    <div className="lob-state" role="alert">
      <p className="lob-state-title">{error}</p>
      <button className="btn btn-primary" onClick={() => load()}>{t('lob.retry')}</button>
    </div>
  );
  if(!data) return <LobbySkeleton label={t('lob.loading')} />;

  const status = lobbyStatus(tournament, data.countdown, offsetRef.current);
  const meter = capacityMeter(data.field);
  const finished = tournament.state === 'completed';

  return (
    <div className={`lob ${reduced ? 'is-calm' : ''} tone-${status.tone}`}>
      {offline && <p className="lob-offline" role="status">{t('lob.offline')}</p>}

      <LobbyHero tournament={tournament} status={status} countdown={data.countdown}
                 offset={offsetRef.current} field={data.field} t={t} formatDate={formatDate}
                 reduced={reduced} action={action} busy={busy} onRun={run}
                 error={error} notice={notice} />

      {finished && <Podium data={data} t={t} />}

      {me?.registered && !finished && <Pass me={me} t={t} formatDate={formatDate} />}

      <div className="lob-grid">
        <Field field={data.field} meter={meter} recent={data.recentRegistrations} t={t} />
        <Info tournament={tournament} bracket={data.bracket} t={t} formatDate={formatDate} />
      </div>

      <TableMap tables={data.tables} t={t} slug={tournament.slug} canOpen={me?.canOpenTable} />
      <Bracket bracket={data.bracket} t={t} />

      <div className="lob-grid">
        <Leaderboard rows={data.leaderboard} t={t} />
        <Activity items={data.activity} t={t} formatDate={formatDate} />
      </div>

      <Docs tournament={tournament} t={t} />

      {/* Mobile: the action follows the visitor down the page. */}
      {action.kind !== 'none' && (
        <div className="lob-sticky">
          <ActionButton action={action} busy={busy} onRun={run} t={t} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- hero */

function LobbyHero({ tournament, status, countdown, offset, field, t, formatDate,
                     reduced, action, busy, onRun, error, notice }){
  return (
    <header className="lob-hero">
      <span className="lob-hero-felt" aria-hidden="true" />
      <span className="lob-hero-grid" aria-hidden="true" />
      {!reduced && <span className="lob-hero-sweep" aria-hidden="true" />}

      <div className="lob-hero-body">
        <p className={`lob-badge is-${status.tone}`}>
          <i className="lob-badge-dot" aria-hidden="true" />
          {t(`lob.status.${status.key}`)}
        </p>

        <h2 className="lob-hero-title">{tournament.title}</h2>

        <ul className="lob-hero-meta">
          <li><span>{t('lob.venue')}</span><b>{tournament.eventSlug}</b></li>
          <li><span>{t('lob.start')}</span><b>{formatDate(tournament.startsAt,{ dateStyle:'medium', timeStyle:'short' })}</b></li>
          <li><span>{t('lob.players')}</span><b>{field.registered}</b></li>
          {tournament.currentRound && <li><span>{t('lob.round')}</span><b>{roundLabel(tournament.currentRound, t)}</b></li>}
        </ul>

        {countdown && <Countdown countdown={countdown} offset={offset} t={t} reduced={reduced} />}

        <div className="lob-hero-action">
          <ActionButton action={action} busy={busy} onRun={onRun} t={t} />
          {error && <p className="lob-error" role="alert">{error}</p>}
          {notice && !error && <p className="lob-notice" role="status">{notice}</p>}
        </div>

        <p className="lob-free">{t('lob.free')}</p>
      </div>
    </header>
  );
}

/** Digits redrawn every second against the server's clock. */
function Countdown({ countdown, offset, t, reduced }){
  const [ms, setMs] = useState(() => remaining(countdown.target, offset));
  useEffect(() => {
    const tick = () => setMs(remaining(countdown.target, offset));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [countdown.target, offset]);

  const p = countdownParts(ms);
  const cells = [
    ...(p.days > 0 ? [[p.days, t('lob.days')]] : []),
    [pad2(p.hours), t('lob.hours')], [pad2(p.minutes), t('lob.min')], [pad2(p.seconds), t('lob.sec')]
  ];
  return (
    <div className="lob-countdown" aria-live="off">
      <span className="lob-countdown-label mono">
        {countdown.label === 'registration_closes' ? t('lob.closesIn') : t('lob.startsIn')}
      </span>
      <span className="lob-countdown-digits">
        {cells.map(([value, unit], i) => (
          <b key={unit} className={reduced ? '' : 'is-ticking'}>
            <span key={`${unit}-${value}`}>{value}</span><i>{unit}</i>
          </b>
        ))}
      </span>
    </div>
  );
}

function ActionButton({ action, busy, onRun, t }){
  const label = t(`lob.act.${action.key}`);
  if(action.kind === 'link')
    return <a className="btn btn-primary lob-cta" href={action.href}>{label}</a>;
  if(action.kind === 'action')
    return (
      <button className="btn btn-primary lob-cta" onClick={() => onRun(action.action)}
              disabled={Boolean(busy)} aria-busy={busy ? 'true' : undefined}>
        {busy ? t('lob.working') : label}
      </button>
    );
  return <span className="lob-cta is-static">{label}</span>;
}

/* ------------------------------------------------------------------ panels */

function Field({ field, meter, recent, t }){
  return (
    <section className="lob-panel">
      <h3 className="lob-panel-title">{t('lob.field')}</h3>
      <dl className="lob-stats">
        {[['registered', field.registered], ['checkedIn', field.checkedIn],
          ['active', field.active], ['eliminated', field.eliminated],
          ['tables', field.tables], ['openSeats', Math.max(0, field.openSeats)]].map(([key, value]) => (
          <div key={key}><dt>{t(`lob.${key}`)}</dt><dd>{value}</dd></div>
        ))}
      </dl>

      <div className="lob-meter">
        <div className="lob-meter-rail"><i style={{ '--fill': `${meter.percent}%` }} /></div>
        <span className="mono">
          {meter.capped ? t('lob.capacity',{ n:meter.registered, max:meter.capacity }) : t('lob.uncapped')}
        </span>
      </div>

      <h4 className="lob-sub">{t('lob.recent')}</h4>
      {recent?.length ? (
        <ul className="lob-recent">
          {recent.map((r, i) => <li key={`${r.displayName}-${i}`}><b>{r.displayName}</b></li>)}
        </ul>
      ) : (
        <div className="lob-empty" role="status">
          <p><b>{t('lob.noneYet')}</b></p><p>{t('lob.noneYetCopy')}</p>
        </div>
      )}
    </section>
  );
}

function Info({ tournament, bracket, t, formatDate }){
  const levels = tournament.blindSchedule?.length || 12;
  const minutes = tournament.blindSchedule?.[0]?.durationMinutes || 10;
  const rows = [
    [t('lob.deadline'), formatDate(tournament.registrationClosesAt,{ dateStyle:'medium', timeStyle:'short' })],
    [t('lob.start'), formatDate(tournament.startsAt,{ dateStyle:'medium', timeStyle:'short' })],
    [t('lob.gameType'), t('lob.holdem')],
    [t('lob.stack'), (tournament.startingStack || 0).toLocaleString()],
    [t('lob.blinds'), t('lob.blindsValue',{ levels, minutes })],
    [t('lob.rounds'), String(bracket.length)],
    [t('lob.advancement'), t('lob.advancementValue',{ n: bracket[0]?.advancementValue ?? 2 })]
  ];
  return (
    <section className="lob-panel">
      <h3 className="lob-panel-title">{t('lob.info')}</h3>
      <dl className="lob-rows">
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>

      <h4 className="lob-sub">{t('lob.prizes')}</h4>
      <ol className="lob-prizes">
        {tournament.prizes?.map(p => (
          <li key={p.placement}>
            <b>0{p.placement}</b>
            <span>{p.ticketQuantity} × {p.ticketTier}</span>
            <i>{p.currency} {p.approximateRetailValue}</i>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Pass({ me, t, formatDate }){
  const rows = [
    [t('lob.passNumber'), me.number ? `#${String(me.number).padStart(3,'0')}` : '—'],
    [t('lob.passStatus'), me.status ? me.status.replaceAll('_',' ') : '—'],
    [t('lob.passRound'), me.round ? roundLabel(me.round, t) : '—'],
    [t('lob.passTable'), me.seat?.label || t('lob.awaitingSeat')],
    [t('lob.passSeat'), me.seat ? String(me.seat.seatIndex + 1) : '—'],
    [t('lob.passCheck'), me.checkedInAt ? formatDate(me.checkedInAt,{ timeStyle:'short' }) : t('lob.notCheckedIn')]
  ];
  return (
    <section className="lob-pass">
      <div className="lob-pass-stub" aria-hidden="true" />
      <div className="lob-pass-body">
        <p className="mono">{t('lob.pass')}</p>
        <h3>{me.displayName}</h3>
        <dl>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </div>
    </section>
  );
}

function TableMap({ tables, t, slug, canOpen }){
  return (
    <section className="lob-panel lob-tables">
      <h3 className="lob-panel-title">{t('lob.map')}</h3>
      {tables?.length ? (
        <ul className="lob-table-grid">
          {tables.map(table => (
            <li key={table.id} className={`lob-table ${table.isMine ? 'is-mine' : ''} is-${table.status}`}>
              <div className="lob-table-oval">
                <span className="lob-table-label">{table.label}</span>
                <span className="lob-table-hand mono">{table.handNumber ? t('lob.hand',{ n:table.handNumber }) : table.status}</span>
                <ul className="lob-table-seats">
                  {Array.from({ length: table.size }, (_, i) => {
                    const seat = table.seats.find(s => s.seatIndex === i);
                    return <li key={i}
                      className={`lob-seat ${seat ? 'is-taken' : 'is-open'} ${seat?.isMe ? 'is-me' : ''} ${seat && !seat.connected ? 'is-away' : ''}`}
                      style={{ '--i': i, '--of': table.size }}
                      title={seat ? `${seat.displayName} · ${seat.stack.toLocaleString()}` : t('lob.openSeats')} />;
                  })}
                </ul>
              </div>
              <p className="lob-table-meta mono">{t('lob.tableSeats',{ used:table.occupied, size:table.size })}</p>
              {table.isMine && (
                canOpen
                  ? <a className="btn btn-sm btn-primary" href={`/play/poker/${slug}/table`}>{t('lob.openTable')}</a>
                  : <span className="lob-table-mine mono">{t('lob.yourTable')}</span>
              )}
            </li>
          ))}
        </ul>
      ) : <div className="lob-empty" role="status"><p>{t('lob.mapEmpty')}</p></div>}
    </section>
  );
}

function Bracket({ bracket, t }){
  return (
    <section className="lob-panel">
      <h3 className="lob-panel-title">{t('lob.bracket')}</h3>
      <ol className="lob-bracket">
        {bracket.map(round => (
          <li key={round.name} className={`is-${round.status} ${round.mine ? 'is-mine' : ''}`}>
            <span className="lob-bracket-dot" aria-hidden="true" />
            <b>{roundLabel(round.name, t)}</b>
            <span className="mono">
              {round.playerCount ? `${round.survivors}/${round.playerCount}` : '—'}
              {round.tableCount ? ` · ${round.tableCount} ${t('lob.tables').toLowerCase()}` : ''}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Leaderboard({ rows, t }){
  const [limit, setLimit] = useState(10);
  const shown = rows.slice(0, limit);
  return (
    <section className="lob-panel">
      <h3 className="lob-panel-title">{t('lob.leaderboard')}</h3>
      {shown.length ? <>
        <ol className="lob-board">
          {shown.map(row => (
            <li key={`${row.displayName}-${row.rank}`} className={row.isMe ? 'is-me' : ''}>
              <b className="lob-board-rank">{row.rank}</b>
              <span className="lob-board-name">{row.displayName}</span>
              <span className="lob-board-table mono">{row.table || '—'}</span>
              <span className="lob-board-chips">{(row.chips ?? 0).toLocaleString()}</span>
            </li>
          ))}
        </ol>
        {rows.length > limit &&
          <button className="btn btn-ghost btn-sm" onClick={() => setLimit(n => n + 20)}>+20</button>}
      </> : <div className="lob-empty" role="status"><p>{t('lob.leaderEmpty')}</p></div>}
    </section>
  );
}

function Activity({ items, t, formatDate }){
  return (
    <section className="lob-panel">
      <h3 className="lob-panel-title">{t('lob.activity')}</h3>
      {items?.length ? (
        <ul className="lob-feed">
          {items.map((item, i) => (
            <li key={`${item.at}-${i}`} className={`is-${item.kind}`}>
              <time className="mono">{formatDate(item.at,{ timeStyle:'short' })}</time>
              <span>{
                item.kind === 'registration' ? t('lob.ev.registration',{ name:item.displayName })
                : item.kind === 'elimination' ? t('lob.ev.elimination',{ name:item.displayName })
                : t(`lob.ev.${item.type}`)
              }</span>
            </li>
          ))}
        </ul>
      ) : <div className="lob-empty" role="status"><p>{t('lob.activityEmpty')}</p></div>}
    </section>
  );
}

function Podium({ data, t }){
  const top = data.leaderboard.filter(r => r.rank && r.rank <= 3);
  const prizes = data.tournament.prizes || [];
  return (
    <section className="lob-podium">
      <h3 className="lob-panel-title">{t('lob.podium')}</h3>
      <ol className="lob-podium-list">
        {top.map(row => {
          const prize = prizes.find(p => p.placement === row.rank);
          return (
            <li key={row.rank} className={`is-place-${row.rank} ${row.isMe ? 'is-me' : ''}`}>
              <b>{row.rank}</b>
              <span className="lob-podium-name">{row.displayName}</span>
              {prize && <i>{prize.ticketQuantity} × {prize.ticketTier}</i>}
            </li>
          );
        })}
      </ol>
      {data.me?.placement && (
        <p className="lob-podium-me">
          {data.me.prizeStatus === 'delivered' ? t('lob.prizeDelivered')
            : data.me.prizeStatus === 'manual_review' ? t('lob.prizePending')
            : ''}
          {' '}<a href="/account">{t('lob.myRewards')}</a>
        </p>
      )}
    </section>
  );
}

function Docs({ tournament, t }){
  const items = [
    { key:'rules', body: tournament.rules?.bodyMarkdown || t('lob.rulesMissing') },
    { key:'eligibility', body: t('lob.eligibilityCopy',{ age: tournament.minimumAge || 18 }) },
    { key:'privacy', body: t('lob.privacyCopy') },
    { key:'fairPlay', body: t('lob.fairPlayCopy') }
  ];
  return (
    <section className="lob-panel">
      <h3 className="lob-panel-title">{t('lob.docs')}</h3>
      <ul className="lob-docs">
        {items.map(item => (
          <li key={item.key}>
            <details>
              <summary>{t(`lob.${item.key}`)}</summary>
              <div>{item.body}</div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LobbySkeleton({ label }){
  return (
    <div className="lob-skeleton" role="status" aria-label={label}>
      <span className="lob-skeleton-hero" />
      <span className="lob-skeleton-row" />
      <span className="lob-skeleton-row" />
    </div>
  );
}

/* ---------------------------------------------------------------- helpers */

const roundLabel = (name, t) => ({
  round_one:'1', round_two:'2', final_round:'F'
}[name] ? `${t('lob.round')} ${{ round_one:'1', round_two:'2', final_round:'F' }[name]}` : name);

/** Turns an API error into something a person can act on. */
function friendly(err, t){
  const known = {
    ALREADY_REGISTERED:'lob.act.registered',
    TOURNAMENT_FULL:'lob.act.full',
    REGISTRATION_CLOSED:'lob.act.closed'
  }[err?.code];
  if(known) return t(known);
  return err?.message || t('lob.offline');
}
