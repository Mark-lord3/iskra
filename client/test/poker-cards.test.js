import test from 'node:test';
import assert from 'node:assert/strict';
import { cardLabel, cardWords, isRed, isHidden, rankOf, suitOf } from '../src/poker/cards.js';
import { cardToString, rankOf as serverRank, suitOf as serverSuit, cardToWords }
  from '../../server/src/poker/cards.js';

/**
 * The client decodes cards the server encoded. If the two ever disagree the
 * table shows the wrong cards, so every one of the 52 is checked against the
 * server's own module rather than against a copy of its rules.
 */
test('all 52 cards decode to exactly what the server encoded', () => {
  const SUIT_GLYPH = { c:'♣', d:'♦', h:'♥', s:'♠' };
  for(let card = 0; card < 52; card++){
    const server = cardToString(card);              // e.g. "Kd"
    const expected = server[0] + SUIT_GLYPH[server[1]];
    assert.equal(cardLabel(card), expected, `card ${card} must read ${expected}`);
    assert.equal(rankOf(card), serverRank(card), `card ${card} rank`);
    assert.equal(suitOf(card), serverSuit(card), `card ${card} suit`);
  }
});

test('every card produces the same spoken text as the server', () => {
  for(let card = 0; card < 52; card++)
    assert.equal(cardWords(card), cardToWords(card), `card ${card} spoken form`);
});

test('the 52 faces are all different', () => {
  const faces = new Set(Array.from({ length: 52 }, (_, i) => cardLabel(i)));
  assert.equal(faces.size, 52);
});

test('only diamonds and hearts read red', () => {
  const red = Array.from({ length: 52 }, (_, i) => i).filter(isRed);
  assert.equal(red.length, 26);
  assert.ok(red.every(card => [1, 2].includes(suitOf(card))));
});

test('a hidden card carries no rank, suit or colour', () => {
  for(const hidden of ['?', null, undefined]){
    assert.equal(isHidden(hidden), true);
    assert.equal(cardLabel(hidden), '', 'a hidden card must render no face');
    assert.equal(isRed(hidden), false, 'a hidden card must not leak its colour');
    assert.equal(cardWords(hidden), 'face down card', 'every hidden card speaks identically');
  }
});
