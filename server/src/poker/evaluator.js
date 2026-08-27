import { rankOf, suitOf } from './cards.js';

/** Hand categories, ordered so a larger number always beats a smaller one. */
export const CATEGORY = {
  HIGH_CARD:0, PAIR:1, TWO_PAIR:2, TRIPS:3, STRAIGHT:4,
  FLUSH:5, FULL_HOUSE:6, QUADS:7, STRAIGHT_FLUSH:8
};
export const CATEGORY_NAME = [
  'high card','pair','two pair','three of a kind','straight',
  'flush','full house','four of a kind','straight flush'
];

/**
 * Score exactly five cards.
 *
 * Returns [category, ...tiebreakers] where every element is comparable left to
 * right. Arrays rather than a packed integer: the tiebreakers stay readable in
 * hand histories and in test failures.
 */
export function scoreFive(cards){
  if(cards.length !== 5) throw new Error('scoreFive needs five cards');
  const ranks = cards.map(rankOf).sort((a,b)=>b-a);
  const suits = cards.map(suitOf);
  const flush = suits.every(s => s === suits[0]);

  // Count ranks, then order by (count, rank) so pairs and trips lead the tiebreak.
  const counts = new Map();
  for(const r of ranks) counts.set(r, (counts.get(r) || 0) + 1);
  const grouped = [...counts.entries()]
    .sort((a,b) => b[1] - a[1] || b[0] - a[0]);
  const shape = grouped.map(g => g[1]).join('');
  const byCount = grouped.map(g => g[0]);

  // Straights, including the five-high wheel where the ace plays low.
  const distinct = [...new Set(ranks)];
  let straightHigh = 0;
  if(distinct.length === 5){
    if(distinct[0] - distinct[4] === 4) straightHigh = distinct[0];
    else if(distinct[0] === 14 && distinct[1] === 5 && distinct[4] === 2) straightHigh = 5;
  }

  if(flush && straightHigh) return [CATEGORY.STRAIGHT_FLUSH, straightHigh];
  if(shape === '41')        return [CATEGORY.QUADS, byCount[0], byCount[1]];
  if(shape === '32')        return [CATEGORY.FULL_HOUSE, byCount[0], byCount[1]];
  if(flush)                 return [CATEGORY.FLUSH, ...ranks];
  if(straightHigh)          return [CATEGORY.STRAIGHT, straightHigh];
  if(shape === '311')       return [CATEGORY.TRIPS, byCount[0], byCount[1], byCount[2]];
  if(shape === '221')       return [CATEGORY.TWO_PAIR, byCount[0], byCount[1], byCount[2]];
  if(shape === '2111')      return [CATEGORY.PAIR, byCount[0], byCount[1], byCount[2], byCount[3]];
  return [CATEGORY.HIGH_CARD, ...ranks];
}

/** Lexicographic compare of two scores. Positive when `a` wins. */
export function compareScores(a, b){
  const n = Math.max(a.length, b.length);
  for(let i = 0; i < n; i++){
    const x = a[i] ?? -1, y = b[i] ?? -1;
    if(x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/* All 21 ways to take five cards from seven, precomputed once. */
const COMBOS_7 = (() => {
  const out = [];
  for(let a=0;a<7;a++) for(let b=a+1;b<7;b++) for(let c=b+1;c<7;c++)
    for(let d=c+1;d<7;d++) for(let e=d+1;e<7;e++) out.push([a,b,c,d,e]);
  return out;
})();

/**
 * Best five-card hand out of five, six or seven cards.
 * @returns {{score:number[], cards:number[], category:number, name:string}}
 */
export function evaluate(cards){
  if(cards.length < 5 || cards.length > 7)
    throw new Error('evaluate takes five to seven cards');

  if(cards.length === 5){
    const score = scoreFive(cards);
    return { score, cards: cards.slice(), category: score[0], name: CATEGORY_NAME[score[0]] };
  }

  let best = null, bestCards = null;
  const pick = new Array(5);
  const indices = cards.length === 7 ? COMBOS_7 : sixCombos();
  for(const combo of indices){
    for(let i=0;i<5;i++) pick[i] = cards[combo[i]];
    const score = scoreFive(pick);
    if(!best || compareScores(score, best) > 0){ best = score; bestCards = pick.slice(); }
  }
  return { score: best, cards: bestCards, category: best[0], name: CATEGORY_NAME[best[0]] };
}

let SIX = null;
function sixCombos(){
  if(SIX) return SIX;
  SIX = [];
  for(let a=0;a<6;a++) for(let b=a+1;b<6;b++) for(let c=b+1;c<6;c++)
    for(let d=c+1;d<6;d++) for(let e=d+1;e<6;e++) SIX.push([a,b,c,d,e]);
  return SIX;
}

/**
 * Rank a showdown. Returns groups of seat ids sharing an identical score,
 * strongest first, so split pots fall out naturally.
 */
export function rankShowdown(entries){
  const scored = entries.map(e => ({ ...e, hand: evaluate(e.cards) }));
  scored.sort((a,b) => compareScores(b.hand.score, a.hand.score));
  const groups = [];
  for(const s of scored){
    const top = groups[groups.length - 1];
    if(top && compareScores(top[0].hand.score, s.hand.score) === 0) top.push(s);
    else groups.push([s]);
  }
  return groups;
}
