import crypto from 'node:crypto';

/**
 * Cards are integers 0..51:  rank = (n >> 2) + 2  (2..14),  suit = n & 3.
 * Integers keep the evaluator allocation-free and make hand histories compact.
 */
export const RANKS = '23456789TJQKA';
export const SUITS = 'cdhs';           // clubs, diamonds, hearts, spades

export const rankOf = card => (card >> 2) + 2;
export const suitOf = card => card & 3;

export const cardToString = card => RANKS[rankOf(card) - 2] + SUITS[suitOf(card)];
export function cardFromString(text){
  const r = RANKS.indexOf(String(text)[0].toUpperCase());
  const s = SUITS.indexOf(String(text)[1].toLowerCase());
  if(r < 0 || s < 0) throw new Error(`Not a card: ${text}`);
  return (r << 2) | s;
}
export const handToString = cards => cards.map(cardToString).join(' ');

/** Screen-reader text: never rely on the suit glyph or colour alone. */
const RANK_WORDS = { 2:'two',3:'three',4:'four',5:'five',6:'six',7:'seven',8:'eight',
  9:'nine',10:'ten',11:'jack',12:'queen',13:'king',14:'ace' };
const SUIT_WORDS = ['clubs','diamonds','hearts','spades'];
export const cardToWords = card => `${RANK_WORDS[rankOf(card)]} of ${SUIT_WORDS[suitOf(card)]}`;

export const freshDeck = () => Array.from({ length: 52 }, (_, i) => i);

/**
 * Fisher-Yates driven by crypto.randomInt, which is uniform and unpredictable.
 * Math.random must never be used here: the deck order decides real prizes.
 */
export function shuffle(deck = freshDeck()){
  const d = deck.slice();
  for(let i = d.length - 1; i > 0; i--){
    const j = crypto.randomInt(i + 1);
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

/**
 * A shuffle is recorded as a commitment: the server publishes the hash before
 * the hand and can reveal the seed afterwards, so a deal can be audited without
 * ever exposing undealt cards while the hand is live.
 */
export function commitShuffle(){
  const seed = crypto.randomBytes(32);
  const deck = shuffle();
  const commitment = crypto.createHash('sha256')
    .update(seed).update(Buffer.from(deck)).digest('hex');
  return { deck, seed: seed.toString('hex'), commitment };
}

export const verifyShuffle = (seedHex, deck, commitment) =>
  crypto.createHash('sha256')
    .update(Buffer.from(seedHex,'hex')).update(Buffer.from(deck))
    .digest('hex') === commitment;
