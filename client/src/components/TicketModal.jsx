import { useEffect, useMemo, useState } from 'react';
import { api, savedPlayer, saveTickets } from '../api.js';
import { useToast } from './Toasts.jsx';
import { money, tiersFor } from '../utils.js';
import { quote as priceQuote, vipTableQuote, clampQty, tierAvailability, MAX_QTY, VIP_TABLE_SEATS } from '../../../shared/pricing.js';
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
  const [vipInfo,setVipInfo] = useState(null);
  const [includeVip,setIncludeVip] = useState(false);
  const [customInput,setCustomInput]=useState(()=>new URLSearchParams(location.search).get('custom_order')||'');
  const [customOrder,setCustomOrder]=useState(null);
  const [customMessage,setCustomMessage]=useState('');

  const tiers = useMemo(() => tiersFor(event, t), [event, t]);
  const isVipTable = includeVip;
  const controlsLocked=Boolean(customOrder);

  const loadVipAvailability=()=>api.vipAvailability(event.id).then(setVipInfo).catch(error=>{
    setVipInfo({capacity:4,sold:0,held:0,remaining:0,nextSlot:null,nextDiscountPercent:0,error:error.message});
  });
  useEffect(()=>{loadVipAvailability();},[event.id]); // eslint-disable-line

  const validate = async (value, silent) => {
    const v = (value ?? input).trim().toUpperCase();
    if (!v) { setCode(null); setMsg(''); return; }
    try {
      const r = await api.validateCode(v,qty,event.id,['general','early'][tierIdx]);
      if (r.valid) {
        setCode(r); setMsg('✓ ' + r.label);
        if(customOrder){
          const refreshed=await api.customOrderPreview({code:customInput,eventSlug:event.id,email:buyerEmail,promoCode:v});
          setCustomOrder(refreshed);
        }
        if (!silent) toast(`Promo ${v} applied`, '✦');
      } else if (r.reason === 'MIN_QTY') {
        setCode(r); setMsg('');
      } else { setCode(null); setMsg('Not valid. ' + (r.error || 'That code is not valid')); }
    } catch (e) { setCode(null); setMsg(e.message); }
  };

  // A code won in Spark Rush is applied for the player automatically.
  useEffect(() => { if (presetCode) validate(presetCode, true); }, [presetCode]); // eslint-disable-line

  useEffect(() => {
    if (!isVipTable||customOrder?.allowPromoStacking) return;
    setQty(current=>Math.min(VIP_TABLE_SEATS,Math.max(1,current)));
    setCode(null);
    setMsg('');
  }, [isVipTable,customOrder?.allowPromoStacking]);

  const applyCustomOrder=async()=>{
    const value=customInput.trim().toUpperCase();
    if(!value){setCustomOrder(null);setCustomMessage('');return;}
    try{
      const result=await api.customOrderPreview({code:value,eventSlug:event.id,email:buyerEmail,promoCode:code?.code||null});
      setCustomOrder(result);setCustomMessage('');
      setQty(Math.max(1,result.admission.qty||1));setTierIdx(result.admission.tierKey==='early'?1:0);setIncludeVip(result.vip.qty>0);
      if(result.customerName&&!buyerName)setBuyerName(result.customerName);
      if(result.customerEmail)setBuyerEmail(result.customerEmail);
      toast(t('checkout.customApplied'),'✦');
    }catch(error){setCustomOrder(null);setCustomMessage(error.message);}
  };

  /* Priced by shared/pricing.js — the same module the server charges with, so
     the figure here is the figure taken. */
  const priced = useMemo(
    () => isVipTable
      ? vipTableQuote({base:event.from,admissionTierKey:['general','early'][tierIdx],admissionQty:qty,tableSlot:vipInfo?.nextSlot||1})
      : priceQuote({ base:event.from, tierKey:['general','early'][tierIdx], qty, promo:code }),
    [event.from, tierIdx, qty, code, isVipTable, vipInfo?.nextSlot]);
  const displayedPricing=customOrder?.pricing||priced;
  const { total, saved, equivalentTickets=0 } = displayedPricing;
  const notes = displayedPricing.lines.map(l => l.label).filter(Boolean);
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
        eventSlug:event.id,tierKey:['general','early'][tierIdx],admissionTierKey:['general','early'][tierIdx],
        includeVip:isVipTable,qty,
        code:code?.code || null,playerId:p?.id || null,locale:language,
        buyerName,buyerEmail,vipExpectedDiscount:isVipTable&&!customOrder?vipInfo?.nextDiscountPercent:0,
        customOrderCode:customOrder?customInput.trim().toUpperCase():null
      });
      if(result.checkoutUrl){
        window.location.assign(result.checkoutUrl);
        return;
      }
      saveTickets(result.tickets);
      setEmailSent(result.emailStatus === 'sent');
      setIssued(result.tickets);
      toast(`Issued ${qty} ticket${qty === 1 ? '' : 's'} for ${event.title.split(':')[0]}`, '✦');
    } catch (e) {
      if(e.code==='VIP_AVAILABILITY_CHANGED'||e.code==='VIP_SOLD_OUT')loadVipAvailability();
      toast(e.message, '!');
    }
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

        <p className="checkout-section-label">{t('checkout.chooseAdmission')}</p>
        {tiers.slice(0,2).map((tierOption, i) => {
          const tierKey = ['general','early'][i];
          const available = availability[tierKey];
          const description = !available && tierKey === 'general' ? t('checkout.earlyClosed')
            : !available && tierKey === 'early' ? t('checkout.lateLocked')
            : tierOption.d;
          return (
            <button type="button" key={tierOption.n}
                    className={'tier' + (i === tierIdx ? ' on' : '')}
                    disabled={!available||controlsLocked} onClick={() => setTierIdx(i)}>
              <span><b>{tierOption.n}</b><small>{description}</small></span>
              <span className="p">{money(tierOption.p)}</span>
            </button>
          );
        })}

        <p className="checkout-section-label">{t('checkout.addOns')}</p>
        <button type="button"
                className={'tier tier-addon' + (includeVip ? ' on' : '')}
                disabled={controlsLocked||!vipInfo || !vipInfo.remaining}
                aria-pressed={includeVip}
                onClick={() => setIncludeVip(value => !value)}>
          <span>
            <b>{tiers[2].n}</b>
            <small>{!vipInfo ? t('checkout.vipChecking')
              : !vipInfo.remaining ? t('checkout.vipSoldOut')
              : t('checkout.vipDescription',{discount:vipInfo.nextDiscountPercent})}</small>
          </span>
          <span className="p">{includeVip ? t('checkout.added') : `+ ${money(tiers[2].p)}`}</span>
        </button>

        {isVipTable&&vipInfo?.remaining>0&&<div className="vip-checkout-breakdown" role="status">
          <b>{t('checkout.vipTableNumber',{slot:vipInfo.nextSlot})}</b>
          <span>{t('checkout.vipSeparateEntry',{discount:vipInfo.nextDiscountPercent})}</span>
          <small>{t('checkout.vipRemaining',{count:vipInfo.remaining})}</small>
        </div>}

        <div className="qty">
          <div>
            <b style={{ fontSize: 14 }}>{t('checkout.quantity')}</b><br />
            <small style={{ color:'var(--dim)', fontSize:12 }}>{t(isVipTable?'checkout.vipAdmissionsHint':'checkout.quantityHint')}</small>
          </div>
          <div className="qty-ctl">
            <button disabled={controlsLocked} onClick={() => setQty(q => Math.max(1, q - 1))} aria-label={t('common.decrease')}>−</button>
            <b>{qty}</b>
            <button disabled={controlsLocked} onClick={() => setQty(q => Math.min(isVipTable?VIP_TABLE_SEATS:MAX_QTY, q + 1))} aria-label={t('common.increase')}>+</button>
          </div>
        </div>

        <div className="promoline">
          <input value={input} placeholder={isVipTable&&!customOrder?.allowPromoStacking ? t('checkout.vipNoPromos') : t('checkout.code')} aria-label={t('checkout.code')}
                 disabled={isVipTable&&!customOrder?.allowPromoStacking}
                 onChange={e => setInput(e.target.value)}
                 onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); validate(); } }} />
          <button className="btn btn-ghost btn-sm" disabled={isVipTable&&!customOrder?.allowPromoStacking} onClick={() => validate()}>{t('checkout.apply')}</button>
        </div>
        <div className="err" style={{ marginTop:-8, color: code && !shortfall ? 'var(--acid)' : '#ff6b6b' }}>
          {isVipTable&&!customOrder?.allowPromoStacking
            ? t('checkout.vipNoPromos')
            : shortfall
            ? t('checkout.needMore',{ code:code.code, min:shortfall.minQty, need:shortfall.need })
            : msg}
        </div>

        <p className="checkout-section-label">{t('checkout.customOrder')}</p>
        <div className="promoline custom-order-line">
          <input value={customInput} placeholder={t('checkout.customPlaceholder')} aria-label={t('checkout.customOrder')}
                 disabled={Boolean(customOrder)} onChange={e=>setCustomInput(e.target.value)}
                 onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();applyCustomOrder();}}}/>
          <button className="btn btn-ghost btn-sm" onClick={()=>customOrder?(setCustomOrder(null),setCustomMessage('')):applyCustomOrder()}>{t(customOrder?'checkout.remove':'checkout.apply')}</button>
        </div>
        {customMessage&&<div className="err custom-order-error">{customMessage}</div>}
        {customOrder&&<section className="custom-order-summary" aria-live="polite">
          <header><span>{t('checkout.privatePackage')}</span><b>{customOrder.title}</b></header>
          {customOrder.description&&<p>{customOrder.description}</p>}
          <ul>{customOrder.admission.qty>0&&<li><span>{t('checkout.customAdmissions',{count:customOrder.admission.qty})}<small>{money(customOrder.pricing.admissionSubtotal)}</small></span><b>{money(customOrder.pricing.lines.find(line=>line.type==='admission')?.total||0)}</b></li>}{customOrder.vip.qty>0&&<li><span>{t('checkout.customVip',{count:customOrder.vip.qty})}<small>{money(customOrder.pricing.vipSubtotal)}</small></span><b>{money(customOrder.pricing.lines.find(line=>line.type==='vip')?.total||0)}</b></li>}</ul>
          {customOrder.vip.inclusions?.length>0&&<small>{customOrder.vip.inclusions.join(' · ')}</small>}
        </section>}

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

        <div className="checkout-cart" aria-label={t('checkout.orderSummary')}>
          <div>
            <span>{customOrder?t('checkout.customAdmissions',{count:customOrder.admission.qty}):t('checkout.cartTickets',{count:qty,tier:tiers[tierIdx].n})}</span>
            <b>{money(customOrder?customOrder.pricing.lines.find(line=>line.type==='admission')?.total||0:isVipTable ? priced.admissionSubtotal : priced.subtotal)}</b>
          </div>
          {isVipTable&&<div>
            <span>{customOrder?t('checkout.customVip',{count:customOrder.vip.qty}):t('checkout.cartVip',{slot:vipInfo?.nextSlot||1})}</span>
            <b>{money(customOrder?customOrder.pricing.lines.find(line=>line.type==='vip')?.total||0:priced.tablePrice)}</b>
          </div>}
          {isVipTable&&!customOrder&&priced.admissionDiscount>0&&<div className="checkout-cart__discount">
            <span>{t('checkout.cartDiscount',{percent:priced.discountPercent})}</span>
            <b>−{money(priced.admissionDiscount)}</b>
          </div>}
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

        <button className="btn btn-primary" style={{ width:'100%' }} disabled={busy || Boolean(shortfall) || (isVipTable&&!customOrder&&!vipInfo?.remaining) || buyerName.trim().length < 2 || !buyerEmail.includes('@')} onClick={checkout}>
          {busy ? t(total > 0 ? 'checkout.redirecting' : 'checkout.issuing') : t(total > 0 ? 'checkout.pay' : 'checkout.reserve')}
        </button>
        <p className="mono" style={{ fontSize:10, color:'var(--dim)', marginTop:14, textAlign:'center', letterSpacing:'.1em' }}>
          {t(total > 0 ? 'checkout.secureNote' : 'checkout.freeNote')}
        </p>
      </div>
    </div>
  );
}
