import TicketCategory from '../components/TicketCategory.jsx';
import { useEffect, useState } from 'react';
import { api, savedTickets, saveTickets } from '../api.js';
import Footer from '../components/Footer.jsx';
import Nav from '../components/Nav.jsx';
import PromoBar from '../components/PromoBar.jsx';
import { money } from '../utils.js';
import {useI18n} from '../i18n.jsx';

function FeedbackForm({ticket,accessToken}){
  const {t}=useI18n();
  const [form,setForm] = useState({rating:5,music:5,venue:5,comment:''});
  const [state,setState] = useState('idle');
  const update = e=>setForm({...form,[e.target.name]:e.target.value});
  const submit = async e=>{
    e.preventDefault();setState('saving');
    try{
      await api.feedback({...form,reference:ticket.reference,accessToken});
      setState('saved');
    }catch(err){ setState(err.message); }
  };
  if(state === 'saved') return <p className="feedback-saved">{t('tickets.feedbackSaved')}</p>;
  return <details className="ticket-feedback">
    <summary>{t('tickets.feedback')}</summary>
    <form onSubmit={submit}>
      <div className="feedback-scores">
        {[['rating','tickets.overall'],['music','tickets.music'],['venue','tickets.venue']].map(([name,key])=><label key={name}><span>{t(key)}</span><select name={name} value={form[name]} onChange={update}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} / 5</option>)}</select></label>)}
      </div>
      <textarea name="comment" value={form.comment} onChange={update} placeholder={t('tickets.comment')} maxLength="800" rows="3" />
      {state !== 'idle' && state !== 'saving' && <p className="err">{state}</p>}
      <button className="btn btn-sm btn-ghost" disabled={state === 'saving'}>{state === 'saving' ? t('tickets.saving') : t('tickets.sendFeedback')}</button>
    </form>
  </details>;
}

export default function TicketsPage({onTickets}){
  const {t,formatDate}=useI18n();
  const credentials = savedTickets();
  const [tickets,setTickets] = useState([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [paymentComplete,setPaymentComplete] = useState('');

  useEffect(()=>{
    const load=async()=>{
      try{
        const sessionId=new URLSearchParams(location.search).get('session_id');
        if(sessionId){
          const completed=await api.completeCheckout(sessionId);
          saveTickets(completed.tickets || []);
          setPaymentComplete(completed.emailStatus === 'sent' ? 'sent' : 'delayed');
          history.replaceState({},'',location.pathname);
        }
        const data=await api.ticketWallet(savedTickets());
        setTickets(data.tickets || []);
      }catch(err){ setError(err.message); }
      finally{ setLoading(false); }
    };
    load();
  },[]);

  return <>
    <PromoBar />
    <Nav onTickets={onTickets} />
    <main>
      <section className="page-hero tickets-hero">
        <div className="wrap">
          <div className="eyebrow">{t('tickets.saved')}</div>
          <h1 className="h-xl">{t('tickets.title')}</h1>
          <p className="lead">{t('tickets.lead')}</p>
        </div>
      </section>
      <section className="section wallet-section">
        <div className="wrap">
          {paymentComplete && <div className="card payment-success" role="status"><b>{t('tickets.paymentComplete')}</b><span>{t(paymentComplete === 'sent' ? 'tickets.paymentCompleteCopy' : 'tickets.emailDelayed')}</span></div>}
          {loading && <div className="wallet-loading" aria-live="polite">{t('tickets.loading')}</div>}
          {error && <div className="card wallet-empty"><h2>{t('tickets.failed')}</h2><p>{error}</p></div>}
          {!loading && !error && tickets.length === 0 && (
            <div className="wallet-empty">
              <span className="chip">{t('tickets.none')}</span>
              <h2 className="h-lg">{t('tickets.first')}</h2>
              <p className="lead">{t('tickets.firstCopy')}</p>
              <a href="/schedule" className="btn btn-primary">{t('common.viewSchedule')}</a>
            </div>
          )}
          <div className="wallet-grid">
            {tickets.map(ticket=>(
              <article className={`wallet-ticket ${ticket.status}`} key={ticket.reference}>
                <div className="wallet-ticket-top">
                  <span className="wallet-status">{ticket.admissionValid===false?t('tickets.tableOnly'):ticket.status === 'redeemed' ? t('common.redeemed') : ticket.status === 'cancelled' ? t('common.cancelled') : t('common.valid')}</span>
                  <code>{ticket.reference}</code>
                </div>
                <div className="wallet-qr"><img src={ticket.qrDataUrl} alt={t('tickets.qrAlt',{reference:ticket.reference})} /></div>
                <div className="wallet-ticket-copy">
                  <span className="eyebrow">{formatDate(ticket.eventDate,{weekday:'long',month:'long',day:'numeric'})}</span>
                  <h2>{ticket.eventTitle}</h2>
                  <p>{ticket.room} · {ticket.tier}</p><TicketCategory ticket={ticket}/>
                  {ticket.admissionValid===false&&<p className="wallet-admission-warning">{t('tickets.tableNeedsEntry')}</p>}
                  <div><span>{ticket.buyerName}</span><b>{ticket.price ? money(ticket.price) : t('common.reserved')}</b></div>
                  {(ticket.status === 'redeemed' || new Date(ticket.eventDate) <= new Date()) && (
                    <FeedbackForm ticket={ticket} accessToken={credentials.find(item=>item.reference === ticket.reference)?.accessToken} />
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
    <Footer />
  </>;
}
