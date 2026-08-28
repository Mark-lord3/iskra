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
export const VIP_TABLE_PRICE = 140;
export const VIP_TABLE_CAPACITY = 4;
export const VIP_TABLE_SEATS = 4;

export const TIER_KEYS = ['general', 'early', 'booth'];
const TIER_MULTIPLIER = { general: 1, early: 1.2 };
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
  if(key === 'booth') return VIP_TABLE_PRICE;
  const price = Math.max(0, Number(base) || 0) * TIER_MULTIPLIER[key];
  return key === 'general' ? Math.max(0, Number(base) || 0) : Math.round(price);
}

export const clampQty = qty =>
  Math.min(MAX_QTY, Math.max(MIN_QTY, Math.floor(Number(qty) || MIN_QTY)));

export const round2 = value => Math.round((Number(value) || 0) * 100) / 100;

export function customDiscountAmount(subtotal, type = 'none', value = 0){
  const amount = Math.max(0, Number(subtotal) || 0);
  const discountValue = Math.max(0, Number(value) || 0);
  if(type === 'percent') return round2(Math.min(amount, amount * Math.min(100, discountValue) / 100));
  if(type === 'fixed') return round2(Math.min(amount, discountValue));
  return 0;
}

/** Server-defined package pricing used by private custom orders. */
export function customOrderQuote({admission = {}, vip = {}, promo = null, allowPromoStacking = false} = {}){
  const admissionQty = Math.max(0, Math.min(MAX_QTY, Math.floor(Number(admission.qty) || 0)));
  const vipQty = Math.max(0, Math.min(VIP_TABLE_CAPACITY, Math.floor(Number(vip.qty) || 0)));
  const admissionUnit = round2(Math.max(0, Number(admission.unitPrice) || 0));
  const vipUnit = round2(Math.max(0, Number(vip.unitPrice) || 0));
  const admissionSubtotal = round2(admissionQty * admissionUnit);
  const vipSubtotal = round2(vipQty * vipUnit);
  const admissionDiscount = customDiscountAmount(admissionSubtotal, admission.discount?.type||admission.discountType, admission.discount?.value??admission.discountValue);
  const vipDiscount = customDiscountAmount(vipSubtotal, vip.discount?.type||vip.discountType, vip.discount?.value??vip.discountValue);
  const admissionAfterCustom = round2(admissionSubtotal - admissionDiscount);
  const eligibility = allowPromoStacking && promo ? promoEligibility(promo, admissionQty) : {eligible:false,reason:'STACKING_DISABLED'};
  const promoDiscount = eligibility.eligible
    ? promoAmount(promo, admissionAfterCustom, admissionQty ? admissionAfterCustom / admissionQty : 0, admissionQty)
    : 0;
  const subtotal = round2(admissionSubtotal + vipSubtotal);
  const total = Math.max(0, round2(admissionAfterCustom - promoDiscount + vipSubtotal - vipDiscount));
  return {
    admissionQty,vipQty,admissionUnit,vipUnit,admissionSubtotal,vipSubtotal,
    admissionDiscount,vipDiscount,promoDiscount,subtotal,total,saved:round2(subtotal-total),
    lines:[
      admissionQty ? {type:'admission',label:'Custom admission package',qty:admissionQty,unit:admissionUnit,subtotal:admissionSubtotal,total:round2(admissionAfterCustom-promoDiscount)} : null,
      vipQty ? {type:'vip',label:'Custom VIP package',qty:vipQty,unit:vipUnit,subtotal:vipSubtotal,total:round2(vipSubtotal-vipDiscount)} : null
    ].filter(Boolean),
    equivalentTickets:admissionUnit>0?round2((admissionDiscount+promoDiscount)/admissionUnit):0,
    promo:promo ? {...eligibility,code:promo.code,applied:eligibility.eligible&&promoDiscount>0} : null
  };
}

/** Admission discount earned by each of the four table positions. */
export function vipTableDiscount(tableSlot){
  const slot = Math.max(1, Math.min(VIP_TABLE_CAPACITY, Math.floor(Number(tableSlot) || 1)));
  return slot <= 2 ? 0.20 : 0.40;
}

/** One table plus separately priced, mandatory admission tickets. */
export function vipTableQuote({base, admissionTierKey = 'general', admissionQty = 1, tableSlot = 1}){
  const qty = Math.min(VIP_TABLE_SEATS, Math.max(1, Math.floor(Number(admissionQty) || 1)));
  const admissionUnit = tierPrice(admissionTierKey, base);
  const admissionSubtotal = round2(admissionUnit * qty);
  const discountRate = vipTableDiscount(tableSlot);
  const admissionDiscount = round2(admissionSubtotal * discountRate);
  const admissionTotal = round2(admissionSubtotal - admissionDiscount);
  const subtotal = round2(VIP_TABLE_PRICE + admissionSubtotal);
  const total = round2(VIP_TABLE_PRICE + admissionTotal);
  return {
    unit:admissionUnit,qty,tableSlot,tablePrice:VIP_TABLE_PRICE,
    admissionTierKey,admissionUnit,admissionSubtotal,admissionDiscount,admissionTotal,
    discountRate,discountPercent:Math.round(discountRate * 100),subtotal,total,
    saved:admissionDiscount,equivalentTickets:admissionUnit > 0 ? round2(admissionDiscount / admissionUnit) : 0,
    lines:[{type:'vip-admission',amount:admissionDiscount,percentOff:Math.round(discountRate * 100),label:`VIP table admission, ${Math.round(discountRate * 100)}% off`}],
    promo:null
  };
}

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
  // VIP tables are fixed-price packages. No campaign, game reward, private
  // code, percentage, or flat-price promotion may reduce this tier.
  const eligibility = tierKey === 'booth' && promo
    ? { eligible:false, reason:'VIP_EXCLUDED', need:0, minQty:Math.max(1, Number(promo.minQty) || 1) }
    : promoEligibility(promo, count);
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
