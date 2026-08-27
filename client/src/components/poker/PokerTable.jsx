import { useMemo } from 'react';
import Seat from './Seat.jsx';
import { CardRow } from './PlayingCard.jsx';
import { Announcer, ShowdownOverlay } from './Overlays.jsx';
import { motionStyle } from '../../poker/motion.js';

/**
 * The felt.
 *
 * Seats sit on an ellipse, rotated so the viewer is always at the bottom. On a
 * narrow screen the ellipse is abandoned rather than shrunk: opponents move to
 * a legible rail and the viewer's own cards and controls stay within reach.
 */
export default function PokerTable({ state, event, announcements = [], reduced,
                                     compact = false, labels = {} }){
  const hand = state?.hand;
  const seats = state?.seats || [];
  const mySeat = state?.mySeat ?? seats.find(s => s.isMe)?.seatIndex ?? null;

  const layout = useMemo(() => seatLayout(seats, mySeat, compact), [seats, mySeat, compact]);

  /* Which animation is playing right now drives the felt's modifier classes,
     so every moving part is sequenced by the same server event. */
  const phase = event?.type;
  const collecting = phase === 'collect';
  const awarding = phase === 'award' ? event : null;
  const dealing = phase === 'deal';
  const flip = phase === 'flip' ? event : null;
  const celebrating = phase === 'celebrate' ? event : null;

  const winningCards = awarding || phase === 'showdown'
    ? (hand?.result?.showdown || []).flatMap(s => s.hole || [])
    : [];

  const board = hand?.board || [];
  const pot = hand?.pot || 0;

  return (
    <div className={['ptable', compact ? 'is-compact' : '', reduced ? 'is-calm' : '',
                     collecting ? 'is-collecting' : '', dealing ? 'is-dealing' : '',
                     celebrating ? 'is-celebrating' : ''].filter(Boolean).join(' ')}
         style={motionStyle(reduced)}>

      <div className="ptable-felt">
        <span className="ptable-rail" aria-hidden="true" />
        <span className="ptable-dealer" aria-hidden="true" />

        <div className="ptable-centre">
          <div className="ptable-pot">
            <span className="mono">{labels.pot || 'Pot'}</span>
            <b className={awarding ? 'is-awarding' : ''}>{pot.toLocaleString()}</b>
            {hand?.pots?.length > 1 && (
              <span className="ptable-sidepots">
                {hand.pots.map((p, i) => (
                  <i key={i}>{i === 0 ? (labels.mainPot || 'Main') : `${labels.sidePot || 'Side'} ${i}`} {p.amount.toLocaleString()}</i>
                ))}
              </span>
            )}
          </div>

          <CardRow cards={board} slots={5} size={compact ? 'sm' : 'md'}
                   flipFrom={flip ? flip.from : -1}
                   highlight={winningCards}
                   label={labels.board || 'Community cards'} />

          <ShowdownOverlay award={awarding} seats={seats} labels={labels} reduced={reduced} />
        </div>

        {seats.map(seat => (
          <Seat key={seat.seatIndex} seat={seat} hand={hand}
                isActor={hand?.actor === seat.seatIndex}
                deadline={state?.actDeadline}
                timerSeconds={state?.actionTimerSeconds}
                position={layout.get(seat.seatIndex)}
                buttonSeat={hand?.buttonSeat}
                blinds={hand?.blinds}
                reaction={reactionFor(event, seat.seatIndex)}
                reduced={reduced}
                compact={compact} />
        ))}
      </div>

      <Announcer announcements={announcements} labels={labels} />
    </div>
  );
}

/** A short reaction on a seat when something happens to that player. */
function reactionFor(event, seatIndex){
  if(!event) return null;
  if(event.type === 'award' && event.winners?.some(w => w.seat === seatIndex)) return 'win';
  if(event.type === 'eliminate' && event.seat === seatIndex) return 'out';
  if(event.type === 'fold' && event.seat === seatIndex) return 'fold';
  if(event.type === 'presence' && event.seat === seatIndex) return event.connected ? 'back' : 'away';
  return null;
}

/**
 * Positions around an ellipse, rotated so the viewer sits at the bottom.
 * Each seat also carries the vector to the middle, which is what the chips
 * follow when a street closes.
 */
export function seatLayout(seats, mySeat, compact){
  const positions = new Map();
  const total = seats.length || 1;
  const mine = seats.findIndex(s => s.seatIndex === mySeat);
  const offset = mine >= 0 ? mine : 0;

  seats.forEach((seat, i) => {
    // Rotate so the viewer is at the bottom of the ellipse (90 degrees).
    const slot = (i - offset + total) % total;
    const angle = (Math.PI / 2) + (slot / total) * Math.PI * 2;
    const x = 50 + Math.cos(angle) * (compact ? 40 : 43);
    const y = 50 + Math.sin(angle) * (compact ? 34 : 38);
    positions.set(seat.seatIndex, {
      left: `${x}%`, top: `${y}%`,
      // Chips travel from the seat back to the centre of the felt.
      '--dx': `${(50 - x) * 0.9}%`, '--dy': `${(50 - y) * 0.9}%`,
      '--seat-i': i
    });
  });
  return positions;
}
