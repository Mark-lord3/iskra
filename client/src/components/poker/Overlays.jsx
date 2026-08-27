import { useEffect, useState } from 'react';

/**
 * The layers above the felt: what just happened, what stage the tournament is
 * at, and whether we are still connected.
 *
 * Everything here has a text form. A player who cannot see the motion still
 * receives the same information through the live region.
 */

/** Rolling commentary of the last few actions. */
export function Announcer({ announcements = [], labels = {} }){
  const latest = announcements[announcements.length - 1];
  return (
    <div className="pannounce" aria-live="polite" aria-atomic="true">
      {latest && (
        <span key={latest.id} className={`pannounce-item is-${latest.move || latest.type}`}>
          {describe(latest, labels)}
        </span>
      )}
    </div>
  );
}

function describe(event, labels){
  if(event.type === 'level')
    return `${labels.blindsUp || 'Blinds up'} — ${event.smallBlind}/${event.bigBlind}${event.ante ? ` (${event.ante} ante)` : ''}`;
  if(event.type === 'eliminate')
    return `${event.name} ${labels.eliminated || 'is eliminated'}`;
  const move = {
    fold:'folds', check:'checks', call:'calls', bet:'bets', raise:'raises to', allIn:'is all in'
  }[event.move] || event.move;
  const amount = event.move === 'allIn' ? '' : event.move === 'raise' ? ` ${(event.to || 0).toLocaleString()}`
    : event.amount ? ` ${event.amount.toLocaleString()}` : '';
  return `${event.name} ${move}${amount}`;
}

/**
 * Tournament moments: registration closing, seating, a round starting, the
 * final table, a winner. Held briefly, then dismissed.
 */
export function StageBanner({ stage, reduced, onDone }){
  const [visible, setVisible] = useState(Boolean(stage));
  useEffect(() => {
    if(!stage) return setVisible(false);
    setVisible(true);
    const timer = setTimeout(() => { setVisible(false); onDone?.(); }, reduced ? 1200 : 2600);
    return () => clearTimeout(timer);
  }, [stage, reduced, onDone]);

  if(!stage || !visible) return null;
  return (
    <div className={`pstage ${reduced ? 'is-calm' : ''}`} role="status">
      <div className="pstage-inner">
        <span className="mono">{stage.eyebrow}</span>
        <b>{stage.title}</b>
        {stage.copy && <p>{stage.copy}</p>}
      </div>
    </div>
  );
}

/** Connection state, always visible when it is anything other than healthy. */
export function ConnectionBanner({ connection, labels = {} }){
  if(connection === 'live' || connection === 'idle') return null;
  const text = {
    connecting: labels.connecting || 'Connecting to the table…',
    reconnecting: labels.reconnecting || 'Connection lost. Reconnecting…',
    error: labels.offline || 'The table is unreachable. Retrying…'
  }[connection] || '';
  return (
    <div className={`pconn is-${connection}`} role="status" aria-live="polite">
      <span className="pconn-dot" aria-hidden="true" />
      {text}
    </div>
  );
}

/** The winner presentation at the end of a hand. */
export function ShowdownOverlay({ award, seats = [], labels = {}, reduced }){
  if(!award) return null;
  const names = award.winners.map(w => w.name).join(' & ');
  const total = award.winners.reduce((sum, w) => sum + w.amount, 0);
  return (
    <div className={`pshowdown ${award.split ? 'is-split' : ''} ${reduced ? 'is-calm' : ''}`} role="status">
      <span className="mono">{award.split ? (labels.splitPot || 'Split pot')
        : award.uncontested ? (labels.wins || 'Wins the pot') : (labels.showdown || 'Showdown')}</span>
      <b>{names}</b>
      <span className="pshowdown-amount">{total.toLocaleString()}</span>
    </div>
  );
}

/** Skeleton while the first snapshot is still on its way. */
export function TableSkeleton({ label = 'Loading the table' }){
  return (
    <div className="pskeleton" role="status" aria-label={label}>
      <div className="pskeleton-felt">
        <div className="pskeleton-board">{[0,1,2,3,4].map(i => <span key={i} style={{ '--i': i }} />)}</div>
      </div>
      <div className="pskeleton-actions">{[0,1,2].map(i => <span key={i} style={{ '--i': i }} />)}</div>
    </div>
  );
}
