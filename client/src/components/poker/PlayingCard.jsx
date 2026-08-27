import { memo } from 'react';
import { cardLabel, cardWords, isHidden, isRed, rankLabel, suitLabel } from '../../poker/cards.js';

/**
 * One card.
 *
 * A face-down card renders nothing but a back: the payload carries '?' rather
 * than a value, so there is no face in the DOM to inspect, and no class name,
 * attribute or label that differs between one hidden card and another.
 *
 * Rank and suit are always written out as text. Colour is a reinforcement, not
 * the way a suit is identified.
 */
function PlayingCard({ card, index = 0, phase = 'idle', highlight = false, size = 'md', flat = false }){
  const hidden = isHidden(card);
  const classes = [
    'pcard', `pcard-${size}`, hidden ? 'is-back' : 'is-face',
    isRed(card) ? 'is-red' : '', highlight ? 'is-winning' : '',
    phase !== 'idle' ? `is-${phase}` : '', flat ? 'is-flat' : ''
  ].filter(Boolean).join(' ');

  return (
    <span className={classes} style={{ '--i': index }} role="img"
          aria-label={hidden ? 'Face down card' : cardWords(card)}>
      {hidden ? (
        <span className="pcard-back" aria-hidden="true" />
      ) : (
        <span className="pcard-face" aria-hidden="true">
          <b>{rankLabel(card)}</b>
          <i>{suitLabel(card)}</i>
        </span>
      )}
    </span>
  );
}

export default memo(PlayingCard);

/** A row of cards that deals in sequence, used for the board and for holdings. */
export function CardRow({ cards = [], slots = 0, phase = 'idle', flipFrom = -1,
                          highlight = [], size = 'md', label }){
  const total = Math.max(slots, cards.length);
  return (
    <div className="pcard-row" role="group" aria-label={label}>
      {Array.from({ length: total }, (_, i) => {
        const card = cards[i];
        if(card === undefined) return <span key={`slot-${i}`} className={`pcard pcard-${size} is-slot`} aria-hidden="true" />;
        const flipping = flipFrom >= 0 && i >= flipFrom;
        return <PlayingCard key={`${i}-${cardLabel(card) || 'x'}`} card={card} index={i - Math.max(flipFrom, 0)}
                            phase={flipping ? 'flip' : phase} size={size}
                            highlight={highlight.includes(card)} />;
      })}
    </div>
  );
}
