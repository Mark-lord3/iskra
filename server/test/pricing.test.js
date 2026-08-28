import test from 'node:test';
import assert from 'node:assert/strict';
import { quote, vipTableQuote, vipTableDiscount, promoEligibility, nextUnlock, tierPrice, tierAvailability, clampQty, MAX_QTY }
  from '../../shared/pricing.js';

/* The three real campaigns, with the minimums the offers page advertises. */
const SPARK40   = { code:'SPARK40',   label:'Early flock, 40% off', off:0.40, minQty:10, maxQty:20, stackable:true, status:'live' };
const FOURPLAY  = { code:'FOURPLAY',  label:'Group of six, 25% off', off:0.25, minQty:6,  maxQty:20, stackable:true, status:'live' };
const RESIDENT8 = { code:'RESIDENT8', label:'Resident series, 20% off', off:0.20, minQty:4, maxQty:20, stackable:true, status:'live' };

const BASE = 25;   // the live event's price

/* ---------------------------------------------- the advertised minimums --- */

test('9 tickets with SPARK40 is refused, and asks for one more', () => {
  const q = quote({ base:BASE, qty:9, promo:SPARK40 });
  assert.equal(q.promo.applied, false);
  assert.equal(q.promo.reason, 'MIN_QTY');
  assert.equal(q.promo.need, 1, 'the page must be able to say "add 1 more ticket"');
});

test('10 tickets with SPARK40 applies 40% off', () => {
  const q = quote({ base:BASE, qty:10, promo:SPARK40 });
  assert.equal(q.promo.applied, true);
  const promoLine = q.lines.find(l => l.type === 'promo');
  assert.equal(promoLine.percentOff, 40);
  // 10 x $25 = $250, then 40% off = $150.
  assert.equal(q.subtotal, 250);
  assert.equal(promoLine.amount, 100);
  assert.equal(q.total, 150);
  assert.equal(q.saved, 100);
  assert.equal(q.equivalentTickets, 4);
});

test('5 tickets with FOURPLAY is refused, and asks for one more', () => {
  const q = quote({ base:BASE, qty:5, promo:FOURPLAY });
  assert.equal(q.promo.applied, false);
  assert.equal(q.promo.reason, 'MIN_QTY');
  assert.equal(q.promo.need, 1);
});

test('6 tickets with FOURPLAY applies 25% off', () => {
  const q = quote({ base:BASE, qty:6, promo:FOURPLAY });
  assert.equal(q.promo.applied, true);
  assert.equal(q.lines.find(l => l.type === 'promo').percentOff, 25);
  // 6 x $25 = $150, then 25% off = $112.50.
  assert.equal(q.subtotal, 150);
  assert.equal(q.total, 112.5);
  assert.equal(q.saved, 37.5);
  assert.equal(q.equivalentTickets, 1.5);
});

test('3 tickets with RESIDENT8 is refused, and asks for one more', () => {
  const q = quote({ base:BASE, qty:3, promo:RESIDENT8 });
  assert.equal(q.promo.applied, false);
  assert.equal(q.promo.reason, 'MIN_QTY');
  assert.equal(q.promo.need, 1);
});

test('4 tickets with RESIDENT8 applies 20% off', () => {
  const q = quote({ base:BASE, qty:4, promo:RESIDENT8 });
  assert.equal(q.promo.applied, true);
  assert.equal(q.lines.find(l => l.type === 'promo').percentOff, 20);
  // 4 x $25 = $100, then 20% off = $80.
  assert.equal(q.subtotal, 100);
  assert.equal(q.total, 80);
  assert.equal(q.saved, 20, 'the page can honestly say "You save $20"');
  assert.equal(q.equivalentTickets, 0.8);
});

/* ------------------------------------------------------- single discount --- */

test('a percentage promotion is the only discount applied', () => {
  const q = quote({ base:BASE, qty:4, promo:RESIDENT8 });
  assert.deepEqual(q.lines.map(l => l.type), ['promo']);
  assert.equal(q.lines[0].amount, 20);
  assert.equal(q.lines[0].amount, q.saved, 'the promo line must equal the saving');
});

test('every quote balances: subtotal minus the lines equals the total', () => {
  for(const promo of [SPARK40, FOURPLAY, RESIDENT8, null])
    for(let qty = 1; qty <= MAX_QTY; qty++){
      const q = quote({ base:BASE, qty, promo });
      const off = q.lines.reduce((sum, l) => sum + l.amount, 0);
      assert.equal(Math.round((q.subtotal - off) * 100) / 100, q.total,
        `${promo?.code || 'no code'} at ${qty}`);
      assert.equal(q.saved, Math.round(off * 100) / 100);
      assert.ok(q.total >= 0, 'a total can never go below zero');
    }
});

/* ------------------------------------------------------------- validity --- */

test('an expired or unstarted promotion is refused whatever the quantity', () => {
  for(const [status, reason] of [['expired','EXPIRED'],['scheduled','NOT_STARTED']]){
    const q = quote({ base:BASE, qty:10, promo:{ ...SPARK40, status } });
    assert.equal(q.promo.applied, false);
    assert.equal(q.promo.reason, reason);
    assert.equal(q.total, quote({ base:BASE, qty:10 }).total, 'price falls back to the plain quote');
  }
});

test('a public promotion discounts the full order after its minimum', () => {
  const q = quote({ base:BASE, qty:12, promo:FOURPLAY });
  const line = q.lines.find(l => l.type === 'promo');
  assert.equal(line.amount, 12 * BASE * 0.25);
});

test('no code keeps the full ticket total', () => {
  const q = quote({ base:BASE, qty:8, promo:null });
  assert.equal(q.subtotal, 200);
  assert.equal(q.total, 200);
  assert.equal(q.saved, 0);
  assert.equal(q.promo, null);
});

test('VIP tables reject every promotion and always keep the fixed package price', () => {
  const promos = [
    SPARK40,
    FOURPLAY,
    RESIDENT8,
    {code:'PRIVATE95',label:'Private 95% off',off:0.95,minQty:1,status:'live'},
    {code:'FLAT',label:'Flat price',flat:1,minQty:1,status:'live'}
  ];
  for(const promo of promos){
    const q = quote({base:BASE,tierKey:'booth',qty:2,promo});
    assert.equal(q.unit,140);
    assert.equal(q.subtotal,280);
    assert.equal(q.total,280,`${promo.code} must not reduce a VIP table order`);
    assert.equal(q.saved,0);
    assert.deepEqual(q.lines,[]);
    assert.equal(q.promo.applied,false);
    assert.equal(q.promo.reason,'VIP_EXCLUDED');
  }
});

test('the first two VIP tables discount admission by 20 percent',()=>{
  assert.equal(vipTableDiscount(1),0.20);
  assert.equal(vipTableDiscount(2),0.20);
  const q=vipTableQuote({base:25,admissionTierKey:'general',admissionQty:4,tableSlot:2});
  assert.equal(q.tablePrice,140);
  assert.equal(q.admissionSubtotal,100);
  assert.equal(q.admissionDiscount,20);
  assert.equal(q.total,220);
  assert.equal(q.tablePrice+q.admissionTotal,q.total,'ticket and VIP line items must balance to the checkout total');
  assert.equal(q.discountPercent,20);
});

test('VIP tables three and four discount admission by 40 percent',()=>{
  assert.equal(vipTableDiscount(3),0.40);
  assert.equal(vipTableDiscount(4),0.40);
  const q=vipTableQuote({base:25,admissionTierKey:'general',admissionQty:4,tableSlot:3});
  assert.equal(q.admissionSubtotal,100);
  assert.equal(q.admissionDiscount,40);
  assert.equal(q.total,200);
  assert.equal(q.discountPercent,40);
});

test('a VIP table always requires between one and four admission tickets',()=>{
  assert.equal(vipTableQuote({base:25,admissionQty:0,tableSlot:1}).qty,1);
  assert.equal(vipTableQuote({base:25,admissionQty:99,tableSlot:1}).qty,4);
});

/* ------------------------------------------------------------- helpers --- */

test('the next unlock is the nearest offer still out of reach', () => {
  const all = [SPARK40, FOURPLAY, RESIDENT8];
  assert.equal(nextUnlock(all, 1).code, 'RESIDENT8');
  assert.equal(nextUnlock(all, 1).need, 3);
  assert.equal(nextUnlock(all, 4).code, 'FOURPLAY');
  assert.equal(nextUnlock(all, 4).need, 2);
  assert.equal(nextUnlock(all, 6).code, 'SPARK40');
  assert.equal(nextUnlock(all, 10), null, 'at ten everything is unlocked');
});

test('quantity is clamped to the order limits', () => {
  assert.equal(clampQty(0), 1);
  assert.equal(clampQty(-5), 1);
  assert.equal(clampQty(999), MAX_QTY);
  assert.equal(clampQty('7'), 7);
  assert.equal(clampQty(NaN), 1);
});

test('tier prices follow the event price', () => {
  assert.equal(tierPrice('general', 25), 25);
  assert.equal(tierPrice('early', 25), 30);
  assert.equal(tierPrice('booth', 25), 140);
  assert.equal(tierPrice('booth', 40), 140, 'the VIP table is a fixed package price');
  assert.equal(tierPrice('nonsense', 25), 25, 'an unknown tier falls back to general');
});

test('early bird closes and late bird opens on the Montréal event date', () => {
  const eventDate = new Date('2026-08-28T19:00:00Z');
  assert.deepEqual(tierAvailability(eventDate,new Date('2026-08-28T03:59:59Z')),
    {general:true,early:false,booth:true,eventDay:false});
  assert.deepEqual(tierAvailability(eventDate,new Date('2026-08-28T04:00:00Z')),
    {general:false,early:true,booth:true,eventDay:true});
});

test('eligibility reports the minimum it is holding out for', () => {
  assert.deepEqual(promoEligibility(SPARK40, 9), { eligible:false, reason:'MIN_QTY', need:1, minQty:10 });
  assert.deepEqual(promoEligibility(SPARK40, 10), { eligible:true, reason:null, need:0, minQty:10 });
  assert.equal(promoEligibility(null, 5).reason, 'NO_CODE');
});
