/**
 * Card decoding. Must match server/src/poker/cards.js exactly:
 * cards are integers 0..51 with rank = (n >> 2) + 2 and suit = n & 3.
 *
 * A hidden card arrives as the string '?' and carries no information at all —
 * there is nothing in the payload to decode, so nothing can leak through here.
 */
export const RANKS = '23456789TJQKA';
export const SUIT_GLYPHS = ['♣', '♦', '♥', '♠'];
export const SUIT_NAMES = ['clubs', 'diamonds', 'hearts', 'spades'];
const RANK_WORDS = { 2:'two',3:'three',4:'four',5:'five',6:'six',7:'seven',8:'eight',
  9:'nine',10:'ten',11:'jack',12:'queen',13:'king',14:'ace' };

export const isHidden = card => card === '?' || card == null;
export const rankOf = card => (card >> 2) + 2;
export const suitOf = card => card & 3;

/** Diamonds and hearts read red; colour is never the only cue. */
export const isRed = card => !isHidden(card) && (suitOf(card) === 1 || suitOf(card) === 2);

export const rankLabel = card => isHidden(card) ? '' : RANKS[rankOf(card) - 2];
export const suitLabel = card => isHidden(card) ? '' : SUIT_GLYPHS[suitOf(card)];
export const cardLabel = card => isHidden(card) ? '' : rankLabel(card) + suitLabel(card);

/** Screen-reader text. Suit is spoken, never left to the glyph or the colour. */
export const cardWords = card =>
  isHidden(card) ? 'face down card' : `${RANK_WORDS[rankOf(card)]} of ${SUIT_NAMES[suitOf(card)]}`;

/** A stable identity so React keeps the same DOM node across a re-deal. */
export const cardKey = (card, fallback) => isHidden(card) ? `hidden-${fallback}` : `c${card}`;
