/**
 * Ticket pricing — the single source of truth.
 *
 * The server imports this to price real orders and the browser imports the very
 * same file to show the calculator, so a discount can never look valid on the
 * page and then be refused at checkout. Nothing here reads a database or a
 * clock: callers pass in the event price and the promotion, which keeps the
 * whole thing testable and keeps the two sides honest.
 */

/** Tickets per order. */
export const MIN_QTY = 1;
export const MAX_QTY = 20;

export const TIER_KEYS = ['general', 'early', 'booth'];
const TIER_MULTIPLIER = { general: 1, early: 1.2, booth: 8 };
const VENUE_TIME_ZONE = 'America/Toronto';

const dateKey = parts => Number(`${parts.year}${parts.month}${parts.day}`);

/** Early bird runs before the Montréal event date; Late bird starts that day. */
export function tierAvailability(eventDate, now = new Date()){
  const event = new Date(eventDate);
  const eventKey = dateKey({
    year:String(event.getUTCFullYear()),
    month:String(event.getUTCMonth() + 1).padStart(2, '0'),
    day:String(event.getUTCDate()).padStart(2, '0')
  });
  const today = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone:VENUE_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(new Date(now)).filter(part => part.type !== 'literal').map(part => [part.type,part.value]));
  const eventDay = dateKey(today) >= eventKey;
  return {general:!eventDay,early:eventDay,booth:true,eventDay};
}

/** A tier's unit price, derived from the event's base price. */
export function tierPrice(tierKey, base){
  const key = TIER_KEYS.includes(tierKey) ? tierKey : 'general';
  const price = Math.max(0, Number(base) || 0) * TIER_MULTIPLIER[key];
  return key === 'general' ? Math.max(0, Number(base) || 0) : Math.round(price);
}

export const clampQty = qty =>
  Math.min(MAX_QTY, Math.max(MIN_QTY, Math.floor(Number(qty) || MIN_QTY)));

export const round2 = value => Math.round((Number(value) || 0) * 100) / 100;

/**
 * Whether a promotion may be used at this quantity.
 *
 * `need` is how many more tickets would unlock it, which is what the page shows
 * instead of a bare refusal.
 */
export function promoEligibility(promo, qty){
  if(!promo) return { eligible:false, reason:'NO_CODE', need:0 };
  const count = clampQty(qty);
  const minQty = Math.max(1, Number(promo.minQty) || 1);
  if(promo.status && promo.status !== 'live')
    return { eligible:false, reason: promo.status === 'expired' ? 'EXPIRED' : 'NOT_STARTED', need:0, minQty };
  if(count < minQty)
    return { eligible:false, reason:'MIN_QTY', need: minQty - count, minQty };
  return { eligible:true, reason:null, need:0, minQty };
}

/** How many more tickets until the next offer in `promos` unlocks. */
export function nextUnlock(promos = [], qty){
  const count = clampQty(qty);
  return promos
    .filter(p => (Number(p.minQty) || 1) > count && (!p.status || p.status === 'live'))
    .map(p => ({ ...p, need: (Number(p.minQty) || 1) - count }))
    .sort((a, b) => a.need - b.need)[0] || null;
}

/**
 * Price an order.
 *
 * Returns every step separately so the page can show the original total, each
 * discount on its own line, the final amount and the exact money saved —
 * all from the same arithmetic the server charges with.
 */
export function quote({ base, tierKey = 'general', qty = 1, promo = null }){
  const count = clampQty(qty);
  const unit = tierPrice(tierKey, base);
  const subtotal = round2(unit * count);
  const eligibility = promoEligibility(promo, count);
  const promoDiscount = eligibility.eligible ? promoAmount(promo, subtotal, unit, count) : 0;
  const lines = promoDiscount > 0 ? [promoLine(promo, promoDiscount)] : [];
  let total = round2(subtotal - promoDiscount);

  total = Math.max(0, round2(total));
  const saved = round2(subtotal - total);

  return {
    unit, qty: count, subtotal, total, saved,
    savedPercent: subtotal > 0 ? Math.round((saved / subtotal) * 100) : 0,
    equivalentTickets: unit > 0 ? round2(saved / unit) : 0,
    lines,
    promo: promo ? {
      code: promo.code,
      label: promo.label || '',
      minQty: Math.max(1, Number(promo.minQty) || 1),
      maxQty: Number(promo.maxQty) || count,
      percentOff: promo.off ? Math.round(promo.off * 100) : 0,
      flat: Number(promo.flat) || 0,
      applied: eligibility.eligible && promoDiscount > 0,
      reason: eligibility.reason,
      need: eligibility.need
    } : null
  };
}

/** The money a promotion takes off a given running total. */
function promoAmount(promo, runningTotal, unit, count){
  if(!promo || count <= 0 || runningTotal <= 0) return 0;
  // A promotion may be limited to part of the order.
  const discountedQty = Math.min(count, Math.max(1, Number(promo.maxQty) || count));
  const share = (runningTotal / count) * discountedQty;
  const amount = promo.flat
    ? share - Number(promo.flat) * discountedQty
    : share * (Number(promo.off) || 0);
  return Math.max(0, round2(Math.min(amount, runningTotal)));
}

const promoLine = (promo, amount) => ({
  type:'promo', code: promo.code, amount,
  percentOff: promo.off ? Math.round(promo.off * 100) : 0,
  flat: Number(promo.flat) || 0,
  label: promo.label || promo.code
});
