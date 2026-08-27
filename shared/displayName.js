/**
 * Display-name moderation.
 *
 * Names arrive from a public form and are rendered on a public leaderboard, so
 * they are validated on the server and the same module is bundled for the
 * client. The filter works on a normalised "skeleton" rather than the raw
 * string, which is what makes evasion (spacing, punctuation, digits-as-letters,
 * repeated letters, mixed alphabets) fail.
 */

const ZERO_WIDTH = /[​-‏‪-‮⁠-⁯﻿­]/g;

/* Cyrillic read phonetically: катches native profanity written in Cyrillic. */
const TRANSLIT = {
  а:'a', б:'b', в:'v', г:'g', ґ:'g', д:'d', е:'e', ё:'e', є:'e', ж:'zh', з:'z',
  и:'i', і:'i', ї:'i', й:'i', к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r',
  с:'s', т:'t', у:'u', ф:'f', х:'h', ц:'c', ч:'ch', ш:'sh', щ:'sh', ъ:'',
  ы:'y', ь:'', э:'e', ю:'yu', я:'ya'
};

/* Cyrillic read visually: catches Latin words disguised with lookalike glyphs,
   e.g. "fuсk" where the c is U+0441. */
const HOMOGLYPH = {
  а:'a', в:'b', е:'e', ё:'e', к:'k', м:'m', н:'h', о:'o', р:'p', с:'c', т:'t',
  у:'y', х:'x', і:'i', ї:'i', ј:'j', ѕ:'s', ԁ:'d', һ:'h', ԍ:'g', ұ:'y', ғ:'f',
  б:'b', г:'r', д:'d', и:'u', л:'n', п:'n', ф:'o', ц:'u', ч:'y', ш:'w', щ:'w',
  ъ:'', ы:'i', ь:'', э:'e', ю:'io', я:'r', й:'i', з:'3', ж:'x'
};

const LEET = {
  '0':'o', '1':'i', '3':'e', '4':'a', '5':'s', '6':'g', '7':'t', '8':'b', '9':'g',
  '@':'a', '$':'s', '!':'i', '|':'i', '+':'t', '(':'c', ')':'o', '*':'', '^':'', '#':''
};

const collapse = s => s.replace(/(.)\1+/g, '$1');

function skeleton(raw, map) {
  let s = String(raw ?? '')
    .replace(ZERO_WIDTH, '')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')      // strip accents so é -> e
    .toLowerCase();

  let out = '';
  for (const ch of s) out += Object.hasOwn(map, ch) ? map[ch] : ch;
  out = out.replace(/[\s\S]/g, c => (Object.hasOwn(LEET, c) ? LEET[c] : c));
  return out.replace(/[^a-z]/g, '');   // drops separators, digits, punctuation
}

/* Roots are matched as substrings, so they are chosen long enough to avoid
   swallowing ordinary words. Short ambiguous stems (ass, cum, hoe, job) are
   deliberately absent and covered by longer compounds instead. */
const ROOTS = [
  // English profanity
  'fuck','fuk','fck','phuck','fuq','fukc','shit','shyt','cunt','kunt','bitch','biatch','btch',
  'whore','slut','dick','cock','pussy','pusy','twat','wank','bastard','asshole','arsehole',
  'dumbass','jackass','asswipe','jizz','cumshot','cumming','cumslut','porn','dildo','blowjob',
  'molest','anal','motherfuck','bullshit','dipshit','shithead',
  // slurs and hate
  'nigger','nigga','niga','faggot','fagot','retard','kike','chink','spic','tranny','coon',
  'gook','wetback','beaner','towelhead','paki','nazi','hitler','kkk','heilhitler','pedo',
  // Russian / Ukrainian, phonetic and visual transliterations
  'hui','huy','huj','xui','xuy','xyi','huesos','huevo',
  'pizd','pzd','blyad','blyat','bliad','bliat','blad','blya','blja',
  'ebat','eban','ebal','ebash','ebuch','ebuchi','zaeb','poeb','vyeb','ueb','naeb',
  'ohue','ohuen','nahui','nahuy','naher','nihua','dolboeb','mudoeb',
  'suka','suki','suchka','mudak','mudil','mudak','gandon','gondon','zalup','droch',
  'pidor','pidar','pidr','pedik','shluh','shlyuh','shalav','govn','gavn','zhop','chmo',
  'kurva','kurwa','manda','mandav','srak','sral','yobani','jobani','pidoras','huyn','huinya'
];

/* Ordinary words that contain a root. Removed before matching so the classic
   Scunthorpe failure cannot happen. */
const ALLOW = [
  'assassin','assassinate','assess','assist','associate','assume','assure','class','glass',
  'grass','mass','pass','passion','bass','brass','compass','embarrass','harass','potassium',
  'cassette','massage','analysis','analyst','analytic','analog','analogue','canal','banal',
  'cucumber','document','circumstance','accumulate','cumberland','cumulus',
  'dickens','dickinson','dickson','benedick','dicker','cockburn','cockatoo','cockpit',
  'peacock','hancock','woodcock','shuttlecock','cocktail','cockney',
  'niger','nigeria','nigerian','niggard','fagott','fagotto',
  'grape','grapefruit','drape','scrape','trapeze','rapeseed','therapeutic',
  'spice','spicy','despicable','auspicious','suspicious','conspicuous',
  'pedometer','pedodont','pakistan','pakistani','raccoon','cocoon','tycoon',
  'scunthorpe','penistone','sussex','essex','middlesex','shiitake','sukarno','sukhoi',
  'nazir','nazim','matsuoka','kunta','sebastian','rebate','debate'
];

/* Collapsing a root can shorten it into something common: "kkk" becomes "k".
   Only roots that survive collapsing with real length are used for the
   repeated-letter pass. */
const ROOTS_C = ROOTS.map(r => { const c = collapse(r); return c.length >= 4 ? c : null; });

function strip(text, list) {
  let out = text;
  for (const word of list) if (word && out.includes(word)) out = out.split(word).join('.');
  return out;
}

/** True when the name carries profanity, a slur, or an evasion of either. */
export function isBlockedName(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.includes('1488')) return true;           // neo-nazi numeric code

  for (const map of [TRANSLIT, HOMOGLYPH]) {
    const skel = skeleton(raw, map);
    if (!skel) continue;
    const skelC = collapse(skel);
    const clean = strip(skel, ALLOW);
    /* A safe word only shields a name that actually contains it. Without this,
       allowing "Niger" would also let "niiigger" through once collapsed. */
    const present = ALLOW.filter(w => skel.includes(w)).map(collapse);
    const cleanC = strip(skelC, present);
    for (let i = 0; i < ROOTS.length; i++) {
      if (clean.includes(ROOTS[i])) return true;
      if (ROOTS_C[i] && cleanC.includes(ROOTS_C[i])) return true;
    }
  }
  return false;
}

/** Visible characters, ignoring zero-width joiners and combining marks. */
export function visibleLength(raw) {
  const s = String(raw ?? '').replace(ZERO_WIDTH, '').normalize('NFC').trim();
  return [...s].filter(c => !/\p{M}/u.test(c)).length;
}

export const NAME_MIN = 3;
export const NAME_MAX = 18;

/**
 * @returns {{ok:true, handle:string} | {ok:false, reason:'length'|'letters'|'blocked'}}
 * `reason` never names the matched word: the caller maps it to a generic,
 * localised message so the filter cannot be probed.
 */
export function validateDisplayName(raw) {
  const handle = String(raw ?? '').replace(ZERO_WIDTH, '').normalize('NFC').replace(/\s+/g, ' ').trim();
  const len = visibleLength(handle);
  if (len < NAME_MIN || len > NAME_MAX) return { ok: false, reason: 'length' };
  if (!/\p{L}/u.test(handle)) return { ok: false, reason: 'letters' };
  if (isBlockedName(handle)) return { ok: false, reason: 'blocked' };
  return { ok: true, handle };
}
