import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardFromString as C, freshDeck } from '../src/poker/cards.js';
import { CATEGORY, compareScores, evaluate, rankShowdown, scoreFive } from '../src/poker/evaluator.js';

const h = s => s.split(' ').map(C);
const cat = s => evaluate(h(s)).category;

test('every category is recognised', () => {
  assert.equal(cat('As Ks Qs Js Ts'), CATEGORY.STRAIGHT_FLUSH);
  assert.equal(cat('5h 4h 3h 2h Ah'), CATEGORY.STRAIGHT_FLUSH);   // steel wheel
  assert.equal(cat('As Ac Ad Ah Kc'), CATEGORY.QUADS);
  assert.equal(cat('As Ac Ad Kh Kc'), CATEGORY.FULL_HOUSE);
  assert.equal(cat('As Qs 9s 5s 2s'), CATEGORY.FLUSH);
  assert.equal(cat('9c 8d 7h 6s 5c'), CATEGORY.STRAIGHT);
  assert.equal(cat('Ah 2c 3d 4s 5h'), CATEGORY.STRAIGHT);          // the wheel
  assert.equal(cat('As Ac Ad 5h 7c'), CATEGORY.TRIPS);
  assert.equal(cat('As Ac Kh Kc 2d'), CATEGORY.TWO_PAIR);
  assert.equal(cat('As Ac Kh Qc 2d'), CATEGORY.PAIR);
  assert.equal(cat('As Kc Qh 9c 7d'), CATEGORY.HIGH_CARD);
});

test('the wheel is a five-high straight, not ace-high', () => {
  const wheel = scoreFive(h('Ah 2c 3d 4s 5h'));
  const six   = scoreFive(h('6h 2c 3d 4s 5h'));
  assert.equal(wheel[1], 5);
  assert.equal(compareScores(six, wheel) > 0, true, 'six-high beats the wheel');
});

test('a king-high flush beats a queen-high flush', () => {
  assert.equal(compareScores(scoreFive(h('Ks Qs 9s 5s 2s')), scoreFive(h('Qs Js 9s 5s 2s'))) > 0, true);
});

test('kickers decide otherwise equal hands', () => {
  assert.equal(compareScores(scoreFive(h('As Ac Kh Qc 9d')), scoreFive(h('As Ac Kh Qc 8d'))) > 0, true);
  assert.equal(compareScores(scoreFive(h('As Ac Kh Qc 9d')), scoreFive(h('Ah Ad Kc Qs 9h'))), 0,
    'identical ranks in different suits are a tie');
});

test('category order is strictly increasing', () => {
  const ladder = ['As Kc Qh 9c 7d','As Ac Kh Qc 2d','As Ac Kh Kc 2d','As Ac Ad 5h 7c',
                  '9c 8d 7h 6s 5c','As Qs 9s 5s 2s','As Ac Ad Kh Kc','As Ac Ad Ah Kc','As Ks Qs Js Ts'];
  for(let i = 1; i < ladder.length; i++)
    assert.equal(compareScores(scoreFive(h(ladder[i])), scoreFive(h(ladder[i-1]))) > 0, true,
      `${ladder[i]} should beat ${ladder[i-1]}`);
});

test('seven cards resolve to the best five', () => {
  // Board pairs the board; the player plays the flush, not two pair.
  const r = evaluate(h('As 9s 7s 4s 2s Kh Kd'));
  assert.equal(r.category, CATEGORY.FLUSH);
  const straight = evaluate(h('9c 8d 7h 6s 5c 2d 2h'));
  assert.equal(straight.category, CATEGORY.STRAIGHT);
  // Trips on board plus a pair in hand is a full house.
  assert.equal(evaluate(h('7c 7d 7h Kc Kd 2s 3s')).category, CATEGORY.FULL_HOUSE);
});

test('the board alone can be the best hand for everyone', () => {
  const board = 'As Ks Qs Js Ts';
  const groups = rankShowdown([
    { seat:0, cards: h(board + ' 2c 3d') },
    { seat:1, cards: h(board + ' 4h 5h') }
  ]);
  assert.equal(groups.length, 1, 'both play the board, so it is a single tied group');
  assert.equal(groups[0].length, 2);
});

test('showdown ranking groups ties and orders the rest', () => {
  const groups = rankShowdown([
    { seat:0, cards: h('As Ac 2d 5h 9c Kd 3s') },   // pair of aces
    { seat:1, cards: h('Ah Ad 2d 5h 9c Kd 3s') },   // pair of aces, same ranks
    { seat:2, cards: h('Kh Kc 2d 5h 9c Kd 3s') }    // trip kings
  ]);
  assert.equal(groups[0].length, 1);
  assert.equal(groups[0][0].seat, 2, 'trips wins');
  assert.equal(groups[1].length, 2, 'the two ace pairs tie');
});

/**
 * The decisive test: score every one of the 2,598,960 distinct five-card hands
 * and check the category counts against the published frequencies. If any
 * branch of the evaluator were wrong these totals could not all line up.
 */
test('all 2,598,960 five-card hands match the known frequencies', () => {
  const deck = freshDeck();
  const counts = new Array(9).fill(0);
  const pick = new Array(5);
  for(let a=0;a<48;a++){ pick[0]=deck[a];
    for(let b=a+1;b<49;b++){ pick[1]=deck[b];
      for(let c=b+1;c<50;c++){ pick[2]=deck[c];
        for(let d=c+1;d<51;d++){ pick[3]=deck[d];
          for(let e=d+1;e<52;e++){ pick[4]=deck[e];
            counts[scoreFive(pick)[0]]++;
          }}}}}
  assert.deepEqual(counts, [
    1302540,  // high card
    1098240,  // pair
    123552,   // two pair
    54912,    // three of a kind
    10200,    // straight
    5108,     // flush
    3744,     // full house
    624,      // four of a kind
    40        // straight flush
  ]);
  assert.equal(counts.reduce((a,b)=>a+b,0), 2598960);
});
