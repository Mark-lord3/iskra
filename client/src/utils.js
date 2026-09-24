import {tierPrice} from '../../shared/pricing.js';

export const pad = n => String(n).padStart(2, '0');

/* Event times are stored as the venue's wall clock in UTC, so they are always
   formatted in UTC. Without this a visitor abroad sees the doors open at 19:00. */
export const fmtDate = (d, opts) =>
  new Date(d).toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts });
export const fmtTime = d => {
  const x = new Date(d);
  return pad(x.getUTCHours()) + ':' + pad(x.getUTCMinutes());
};
export const dayNum = d => pad(new Date(d).getUTCDate());
export const money = n => '$' + (Math.round(n * 100) / 100).toFixed(n % 1 ? 2 : 0);
export const REDUCED = typeof matchMedia !== 'undefined'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const tiersFor = (e, t = key => key) => {
  const base = Number.isFinite(Number(e.from)) ? Number(e.from) : 8;
  if(e.pricing?.mode==='category') return [
    {n:t('event.women'),d:t('event.online'),p:e.pricing.general},
    {n:t('event.men'),d:t('event.online'),p:e.pricing.early},
    {n:t('checkout.booth'),d:t('event.vip'),p:e.pricing.vipPrice}
  ];
  return [
    { n:t('checkout.general'), d:t('checkout.generalDesc'), p:tierPrice('general',base) },
    { n:t('checkout.early'), d:t('checkout.earlyDesc'), p:tierPrice('early',base) },
    { n:t('checkout.booth'), d:t('checkout.boothDesc'), p:tierPrice('booth',base) }
  ];
};

export const nextEvent = events => {
  const now = Date.now();
  return events.filter(e => new Date(e.endsAt||e.date).getTime() > now && e.sold < 100)
               .sort((a, b) => new Date(a.date) - new Date(b.date))[0] || events[0] || null;
};
