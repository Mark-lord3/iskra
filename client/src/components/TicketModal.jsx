import { useEffect, useMemo, useState } from 'react';
import { api, savedPlayer, saveTickets } from '../api.js';
import { useToast } from './Toasts.jsx';
import { money, tiersFor } from '../utils.js';
import { quote as priceQuote, clampQty, tierAvailability, MAX_QTY } from '../../../shared/pricing.js';
import {useI18n} from '../i18n.jsx';

export default function TicketModal({ event, presetCode, presetQty, onClose }) {
  const {t,formatDate,language}=useI18n();
  const toast = useToast();
  const availability = tierAvailability(event.date);
  const [tierIdx, setTierIdx] = useState(() => availability.early ? 1 : 0);
  const [qty, setQty] = useState(() => presetQty ? clampQty(presetQty) : 1);
  const [input, setInput] = useState(presetCode || '');
  const [code, setCode] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [issued, setIssued] = useState([]);
  const [emailSent,setEmailSent] = useState(false);

  const tiers = useMemo(() => tiersFor(event, t), [event, t]);
  const tier = tiers[tierIdx];

  const validate = async (value, silent) => {
    const v = (value ?? input).trim().toUpperCase();
    if (!v) { setCode(null); setMsg(''); return; }
    try {
      const r = await api.validateCode(v,qty,event.id);
      if (r.valid) {
        setCode(r); setMsg('✓ ' + r.label);
        if (!silent) toast(`Promo <b>${v}</b> applied`, '✦');
      } else if (r.reason === 'MIN_QTY') {
        setCode(r); setMsg('');
      } else { setCode(null); setMsg('Not valid. ' + (r.error || 'That code is not valid')); }
    } catch (e) { setCode(null); setMsg(e.message); }
  };

  // A code won in Spark Rush is applied for the player automatically.
  useEffect(() => { if (presetCode) validate(presetCode, true); }, [presetCode]); // eslint-disable-line

  /* Priced by shared/pricing.js — the same module the server charges with, so
     the figure here is the figure taken. */
  const priced = useMemo(
    () => priceQuote({ base:event.from, tierKey:['general','early','booth'][tierIdx], qty, promo:code }),
    [event.from, tierIdx, qty, code]);
  const { total, saved, equivalentTickets } = priced;
  const notes = priced.lines.map(l => l.label);
  const ticketEquivalent = Number.isInteger(equivalentTickets)
    ? equivalentTickets : equivalentTickets.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  // A code that needs more tickets says so instead of quietly not applying.
  const shortfall = code && !priced.promo.applied && priced.promo.reason === 'MIN_QTY'
    ? priced.promo : null;

  const checkout = async () => {
    setBusy(true);
    try {
      const p = savedPlayer();
      const result = await api.checkoutTickets({
        eventSlug:event.id,tierKey:['general','early','booth'][tierIdx],qty,
        code:code?.code || null,playerId:p?.id || null,locale:language,
        buyerName,buyerEmail
      });
      if(result.checkoutUrl){
        window.location.assign(result.checkoutUrl);
        return;
      }
      saveTickets(result.tickets);
      setEmailSent(result.emailStatus === 'sent');
      setIssued(result.tickets);
      toast(`Issued ${qty} ticket${qty === 1 ? '' : 's'} for ${event.title.split(':')[0]}`, '✦');
    } catch (e) { toast(e.message, '!'); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const d = new Date(event.date);
  if(issued.length){
    const first = issued[0];
    return (
      <div className="modal open" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal-in ticket-issued">
          <button className="x ticket-issued-close" onClick={onClose} aria-label={t('checkout.close')}>×</button>
          <span className="chip"><span className="dot" /> {t('checkout.ready')}</span>
          <h3>{issued.length === 1 ? t('checkout.oneReady') : t('checkout.manyReady',{count:issued.length})}</h3>
          <img src={first.qrDataUrl} alt={t('tickets.qrAlt',{reference:first.reference})} />
          <code>{first.reference}</code>
          <p>{t(emailSent ? 'checkout.saved' : 'checkout.emailDelayed')}</p>
          <a className="btn btn-primary" href="/tickets" onClick={onClose}>{t('checkout.open')}</a>
        </div>
      </div>
    );
  }
  return (
    <div className="modal open" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-in">
        <div className="modal-head">
          <div>
            <h3>{event.title}</h3>
            <p>{formatDate(event.date,{weekday:'short',day:'numeric',month:'short'}).toUpperCase()}, {event.room.toUpperCase()}</p>
          </div>
          <button className="x" onClick={onClose} aria-label={t('checkout.close')}>×</button>
        </div>

        {tiers.map((tierOption, i) => {
          const tierKey = ['general','early','booth'][i];
          const available = availability[tierKey];
          const description = !available && tierKey === 'general' ? t('checkout.earlyClosed')
            : !available && tierKey === 'early' ? t('checkout.lateLocked') : tierOption.d;
          return (
            <button type="button" key={tierOption.n}
                    className={'tier' + (i === tierIdx ? ' on' : '')}
                    disabled={!available} onClick={() => setTierIdx(i)}>
              <span><b>{tierOption.n}</b><small>{description}</small></span>
              <span className="p">{money(tierOption.p)}</span>
            </button>
          );
        })}

        <div className="qty">
          <div>
            <b style={{ fontSize: 14 }}>{t('checkout.quantity')}</b><br />
            <small style={{ color:'var(--dim)', fontSize:12 }}>{t('checkout.quantityHint')}</small>
          </div>
          <div className="qty-ctl">
            <button onClick={() => setQty(q => Math.max(1, q - 1))} aria-label={t('common.decrease')}>−</button>
            <b>{qty}</b>
            <button onClick={() => setQty(q => Math.min(MAX_QTY, q + 1))} aria-label={t('common.increase')}>+</button>
          </div>
        </div>

        <div className="promoline">
          <input value={input} placeholder={t('checkout.code')} aria-label={t('checkout.code')}
                 onChange={e => setInput(e.target.value)}
                 onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); validate(); } }} />
          <button className="btn btn-ghost btn-sm" onClick={() => validate()}>{t('checkout.apply')}</button>
        </div>
        <div className="err" style={{ marginTop:-8, color: code && !shortfall ? 'var(--acid)' : '#ff6b6b' }}>
          {shortfall
            ? t('checkout.needMore',{ code:code.code, min:shortfall.minQty, need:shortfall.need })
            : msg}
        </div>

        <div className="ticket-holder-fields">
          <label>
            <span>{t('checkout.holder')}</span>
            <input value={buyerName} onChange={e=>setBuyerName(e.target.value)} placeholder={t('checkout.name')} autoComplete="name" maxLength="100" />
          </label>
          <label>
            <span>{t('checkout.receipt')}</span>
            <input type="email" value={buyerEmail} onChange={e=>setBuyerEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" maxLength="200" />
          </label>
        </div>

        <div className="total">
          <div>
            <span>{t('checkout.total')}</span>
            <div className="save">{saved > 0
              ? `${t('checkout.youSave',{amount:money(saved)})}: ${notes.join(' + ')}. ${t('checkout.ticketEquivalent',{count:ticketEquivalent})}`
              : ''}</div>
          </div>
          <b>{total <= 0 ? 'FREE' : money(total)}</b>
        </div>

        <button className="btn btn-primary" style={{ width:'100%' }} disabled={busy || Boolean(shortfall) || buyerName.trim().length < 2 || !buyerEmail.includes('@')} onClick={checkout}>
          {busy ? t(total > 0 ? 'checkout.redirecting' : 'checkout.issuing') : t(total > 0 ? 'checkout.pay' : 'checkout.reserve')}
        </button>
        <p className="mono" style={{ fontSize:10, color:'var(--dim)', marginTop:14, textAlign:'center', letterSpacing:'.1em' }}>
          {t(total > 0 ? 'checkout.secureNote' : 'checkout.freeNote')}
        </p>
      </div>
    </div>
  );
}
