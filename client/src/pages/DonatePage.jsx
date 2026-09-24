import {useEffect,useRef,useState} from 'react';
import Nav from '../components/Nav.jsx';
import Footer from '../components/Footer.jsx';
import {useI18n} from '../i18n.jsx';
import {api} from '../api.js';

export default function DonatePage({onTickets}) {
  const {t,language,locale}=useI18n();
  const [amount,setAmount]=useState('10');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [result,setResult]=useState(null);
  const sessionId=new URLSearchParams(location.search).get('session_id');
  const cancelled=new URLSearchParams(location.search).has('cancelled');
  const submitting=useRef(false);
  const [checking,setChecking]=useState(Boolean(sessionId));
  async function check() {
    setChecking(true);setError('');
    try { setResult(await api.donationStatus(sessionId)); }
    catch { setError('donate.verifyError'); }
    finally { setChecking(false); }
  }
  useEffect(()=>{if(sessionId)check();},[sessionId]);
  async function submit(event) {
    event.preventDefault();
    if(submitting.current)return;
    const normalized=amount.trim().replace(',','.');
    const cents=Math.round(Number(normalized)*100);
    if(!/^\d+(\.\d{1,2})?$/.test(normalized)||cents<100||cents>100000){setError('donate.invalid');return;}
    submitting.current=true;setBusy(true);setError('');
    try {
      const data=await api.donate({amountCents:cents,locale:language});
      const url=new URL(data.url);
      if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new Error('Invalid checkout URL');
      window.location.assign(url.href);
    } catch { setError('donate.error');submitting.current=false;setBusy(false); }
  }
  return <>
    <Nav onTickets={onTickets}/>
    <main className="donate-page">
      <section className="section"><div className="wrap donate-layout">
        <div className="donate-story">
          <p className="eyebrow">PROJECT ISKRA · MONTRÉAL</p>
          <h1 className="h-xl">{t('donate.title')}</h1>
          <p className="lead">{t('donate.lead')}</p>
          <figure><img src="/events/2026-08-28/avanesianpro-024.jpg" alt={t('donate.photoAlt')} width="1600" height="1067"/><figcaption>28.08.2026 · Project ISKRA · avanesianpro</figcaption></figure>
        </div>
        <div className="donate-form-panel">
          {checking ? <p role="status">{t('donate.checking')}</p> : result?.paid ? <div role="status">
            <h2 className="h-lg">{t('donate.thanks')}</h2>
            <p className="lead">{t('donate.received',{amount:new Intl.NumberFormat(locale,{style:'currency',currency:'CAD'}).format(result.amountCents/100)})}</p>
            <a href="/gallery" className="btn btn-ghost">{t('nav.gallery')}</a>
          </div> : sessionId ? <div>
            <h2 className="h-lg">{t('donate.pending')}</h2>
            <p>{t('donate.pendingCopy')}</p>
            <button type="button" className="btn btn-primary" onClick={check}>{t('donate.recheck')}</button>
          </div> : <form onSubmit={submit}>
            <h2 className="h-lg">{t('donate.choose')}</h2>
            <p>{t('donate.once')}</p>
            {cancelled&&<p role="status">{t('donate.cancelled')}</p>}
            <div className="donate-presets" role="group" aria-label={t('donate.choose')}>
              {[5,10,25,50].map(value=><button className="btn btn-ghost" type="button" aria-pressed={Number(amount)===value} key={value} onClick={()=>setAmount(String(value))}>{value} $</button>)}
            </div>
            <label htmlFor="donation-amount">{t('donate.amount')}</label>
            <div className="donate-amount"><input id="donation-amount" inputMode="decimal" value={amount} maxLength={7} onChange={event=>setAmount(event.target.value)} aria-describedby="donation-hint" required/><span>CAD</span></div>
            <p id="donation-hint">{t('donate.range')}</p>
            <button className="btn btn-primary" disabled={busy} type="submit">{t(busy?'donate.opening':'donate.submit')} →</button>
            <p className="donate-note">{t('donate.note')}</p>
          </form>}
          {error&&<p role="alert" className="donate-error">{t(error)}</p>}
          <a href="/contact">{t('donate.contact')}</a>
        </div>
      </div></section>
    </main>
    <Footer/>
  </>;
}
