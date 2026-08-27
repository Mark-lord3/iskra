import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDisplayName, isBlockedName, visibleLength, NAME_MIN, NAME_MAX }
  from '../../shared/displayName.js';

const allow = name => assert.equal(validateDisplayName(name).ok, true, `expected "${name}" to be allowed`);
const block = name => assert.equal(validateDisplayName(name).ok, false, `expected "${name}" to be blocked`);

test('ordinary names pass', () => {
  ['Mark', 'DJ MLNK', 'Олена', 'Дмитро', 'Ivan_92', 'Мар\'яна', 'Anna-Maria', 'Sanyok', 'kick_drum']
    .forEach(allow);
});

test('false positives are not blocked', () => {
  ['Assassin', 'Scunthorpe', 'Sebastian', 'Nigeria', 'Cockburn', 'Analyst', 'Peacock',
   'Cucumber', 'Therapeutic', 'Pakistan', 'Class', 'Grapefruit', 'Sukarno', 'Document',
   'Penistone', 'Shiitake', 'Nazir'].forEach(allow);
});

test('plain English profanity and slurs are blocked', () => {
  ['fuck', 'FUCK', 'shit', 'cunt', 'bitch', 'slut', 'nigger', 'faggot', 'retard', 'hitler']
    .forEach(block);
});

test('Russian and Ukrainian profanity is blocked', () => {
  ['сука', 'ХУЙ', 'блядь', 'бля', 'пидорас', 'ебать', 'заебал', 'мудак', 'курва', 'гандон']
    .forEach(block);
});

test('transliterated profanity is blocked', () => {
  ['suka', 'xyi', 'huy', 'pidor', 'blyat', 'kurwa', 'mudak', 'zaeb', 'nahui'].forEach(block);
});

test('separator evasion is blocked', () => {
  ['f u c k', 'f.u.c.k', 'f-u-c-k', 'f_u_c_k', 's u k a', 'н и г г е р'.replace(/ /g, ''), 'c*u*n*t']
    .forEach(block);
});

test('repeated-letter evasion is blocked', () => {
  ['fuuuck', 'fuckkk', 'shiiit', 'suuuka', 'niiigger'].forEach(block);
});

test('digits-as-letters evasion is blocked', () => {
  ['n1gg3r', 'sh1t', 'f4ggot', 'b1tch', '5hit'].forEach(block);
});

test('mixed alphabet homoglyphs are blocked', () => {
  // Latin words disguised with Cyrillic lookalikes
  block('fuсk');        // Cyrillic с
  block('сunt');        // Cyrillic с
  block('nigger'.replace('e', 'е'));   // Cyrillic е
  block('bitсh');       // Cyrillic с
});

test('the neo-nazi numeric code is blocked', () => {
  ['1488', '14 88', 'x1488x'].forEach(block);
});

test('length is enforced at 3 to 18 visible characters', () => {
  block('ab');
  allow('abc');
  allow('a'.repeat(NAME_MAX));
  block('a'.repeat(NAME_MAX + 1));
  assert.equal(NAME_MIN, 3);
});

test('zero-width and combining characters do not inflate length', () => {
  assert.equal(visibleLength('a​b​c'), 3);
  assert.equal(visibleLength('éée'.normalize('NFD')), 3);
  block('f​u​c​k');
});

test('names without any letter are rejected', () => {
  ['123', '...', '   ---   '].forEach(block);
});

test('the reason never names the matched word', () => {
  const r = validateDisplayName('fuck');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'blocked');
  assert.equal(Object.keys(r).join(','), 'ok,reason');
});

test('isBlockedName is usable on its own', () => {
  assert.equal(isBlockedName('Mark'), false);
  assert.equal(isBlockedName('suka'), true);
});
