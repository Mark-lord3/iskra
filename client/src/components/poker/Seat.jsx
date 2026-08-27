import { memo, useEffect, useState } from 'react';
import { CardRow } from './PlayingCard.jsx';

/**
 * A player's place at the table.
 *
 * The active seat carries a pulsing ring and a countdown that reads from the
 * server's own deadline, so the clock a player sees is the clock the server is
 * actually keeping. Every visual cue has a text equivalent for anyone who
 * cannot see it.
 */
function Seat({ seat, hand, isActor, deadline, timerSeconds, position, reaction,
                buttonSeat, blinds, reduced, compact = false }){
  const remaining = useCountdown(isActor ? deadline : null);
  const seatHand = hand?.seats?.find(s => s.seat === seat.seatIndex);
  const committed = seatHand?.committed || 0;
  const folded = seatHand?.folded;
  const allIn = seatHand?.allIn;

  const share = deadline && timerSeconds ? Math.max(0, Math.min(1, remaining / (timerSeconds * 1000))) : 1;
  const urgent = isActor && remaining > 0 && remaining < 6000;

  const marker = seat.seatIndex === buttonSeat ? 'D'
    : seat.seatIndex === blinds?.sbSeat ? 'SB'
    : seat.seatIndex === blinds?.bbSeat ? 'BB' : null;

  const classes = ['pseat',
    isActor ? 'is-acting' : '', folded ? 'is-folded' : '', allIn ? 'is-allin' : '',
    seat.status === 'eliminated' ? 'is-out' : '',
    seat.status === 'sitting_out' ? 'is-away' : '',
    seat.connected === false ? 'is-offline' : '',
    seat.isMe ? 'is-me' : '', urgent ? 'is-urgent' : '',
    reaction ? `has-reaction react-${reaction}` : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} style={position} data-seat={seat.seatIndex}>
      {isActor && (
        <span className="pseat-ring" aria-hidden="true"
              style={{ '--turn': share, animationDuration: reduced ? '0s' : undefined }} />
      )}
      <div className="pseat-body">
        <b className="pseat-name">{seat.displayName}</b>
        <span className="pseat-stack">{(seat.stack ?? 0).toLocaleString()}</span>
        {marker && <span className={`pseat-marker is-${marker.toLowerCase()}`} aria-label={
          marker === 'D' ? 'Dealer button' : marker === 'SB' ? 'Small blind' : 'Big blind'}>{marker}</span>}
      </div>

      {seatHand && (seatHand.hole || []).length > 0 && (
        <div className={`pseat-hole ${folded ? 'is-mucked' : ''}`}>
          <CardRow cards={seatHand.hole} size={compact ? 'xs' : 'sm'}
                   label={seat.isMe ? 'Your cards' : `${seat.displayName}'s cards`} />
        </div>
      )}

      {committed > 0 && (
        <span className="pseat-bet" aria-label={`${seat.displayName} has ${committed} in front`}>
          <i className="pchip" aria-hidden="true" />{committed.toLocaleString()}
        </span>
      )}

      {/* Status is spoken as text, never left to colour or motion alone. */}
      <span className="pseat-status">
        {seat.status === 'eliminated' ? 'Out'
          : seat.status === 'sitting_out' ? 'Sitting out'
          : seat.connected === false ? 'Reconnecting'
          : allIn ? 'All in'
          : folded ? 'Folded'
          : isActor ? `To act${remaining > 0 ? ` · ${Math.ceil(remaining / 1000)}s` : ''}`
          : ''}
      </span>

      {reaction && <span className="pseat-reaction" aria-hidden="true" />}
    </div>
  );
}

/** Counts down from the server's deadline rather than from a local start time. */
function useCountdown(deadline){
  const [remaining, setRemaining] = useState(() => deadline ? Math.max(0, deadline - Date.now()) : 0);
  useEffect(() => {
    if(!deadline) return setRemaining(0);
    const tick = () => setRemaining(Math.max(0, deadline - Date.now()));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [deadline]);
  return remaining;
}

export default memo(Seat);
