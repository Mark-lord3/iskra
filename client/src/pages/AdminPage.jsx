import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Logo from '../components/Logo.jsx';
import { useToast } from '../components/Toasts.jsx';

const defaultEvent = { title:'', slug:'', date:'', support:'', room:'Main Hall', tags:'techno', badges:'new', from:25, was:0, sold:0 };
const defaultBanner = { title:'', text:'', cta:'Join the list', href:'/newsletter', placement:'home', active:true };

export default function AdminPage() {
  const toast = useToast();
  const [key, setKey] = useState(() => localStorage.getItem('iskra_admin_key') || 'iskra-local-admin');
  const [data, setData] = useState(null);
  const [eventForm, setEventForm] = useState(defaultEvent);
  const [bannerForm, setBannerForm] = useState(defaultBanner);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      localStorage.setItem('iskra_admin_key', key);
      setData(await api.adminSummary(key));
    } catch (err) { toast(err.message, '!'); }
    finally { setBusy(false); }
  };

  useEffect(() => { load(); }, []);

  const updateEvent = e => setEventForm({ ...eventForm, [e.target.name]: e.target.value });
  const updateBanner = e => setBannerForm({ ...bannerForm, [e.target.name]: e.target.value });

  const saveEvent = async e => {
    e.preventDefault();
    await api.adminEvent(key, eventForm);
    setEventForm(defaultEvent);
    toast('Schedule saved.', 'OK');
    load();
  };

  const saveBanner = async e => {
    e.preventDefault();
    await api.adminBanner(key, bannerForm);
    setBannerForm(defaultBanner);
    toast('Promotion banner saved.', 'OK');
    load();
  };

  const removeEvent = async slug => {
    await api.adminDeleteEvent(key, slug);
    toast('Schedule item removed.', 'OK');
    load();
  };

  const markRead = async id => {
    await api.adminMessage(key, id, 'read');
    load();
  };

  const totals = data?.totals || {};

  return (
    <main className="admin-page">
      <header className="admin-top">
        <a href="/" className="logo"><Logo />ISKRA admin</a>
        <div className="admin-key">
          <input value={key} onChange={e => setKey(e.target.value)} aria-label="Admin key" />
          <button className="btn btn-sm btn-primary" onClick={load} disabled={busy}>{busy ? 'Loading' : 'Refresh'}</button>
        </div>
      </header>

      <section className="admin-metrics">
        {[
          ['Visits', totals.visits || 0],
          ['Clicks', totals.clicks || 0],
          ['Promo signups', totals.subscribers || 0],
          ['Messages', totals.messages || 0],
          ['Orders', totals.orders || 0]
        ].map(([label, value]) => (
          <article key={label}><span>{label}</span><b>{value}</b></article>
        ))}
      </section>

      <section className="admin-grid">
        <form className="admin-panel" onSubmit={saveEvent}>
          <h2>Post schedule</h2>
          <input name="title" placeholder="Event title" value={eventForm.title} onChange={updateEvent} required />
          <input name="slug" placeholder="event-slug" value={eventForm.slug} onChange={updateEvent} />
          <input name="date" type="datetime-local" value={eventForm.date} onChange={updateEvent} required />
          <input name="support" placeholder="Support / subtitle" value={eventForm.support} onChange={updateEvent} />
          <input name="room" placeholder="Room" value={eventForm.room} onChange={updateEvent} />
          <input name="tags" placeholder="tags comma separated" value={eventForm.tags} onChange={updateEvent} />
          <div className="admin-inline">
            <input name="from" type="number" min="0" value={eventForm.from} onChange={updateEvent} />
            <input name="sold" type="number" min="0" max="100" value={eventForm.sold} onChange={updateEvent} />
          </div>
          <button className="btn btn-primary">Save schedule</button>
        </form>

        <form className="admin-panel" onSubmit={saveBanner}>
          <h2>Add promotion banner</h2>
          <input name="title" placeholder="Banner title" value={bannerForm.title} onChange={updateBanner} required />
          <textarea name="text" placeholder="Offer copy" value={bannerForm.text} onChange={updateBanner} rows="4" />
          <input name="cta" placeholder="Button text" value={bannerForm.cta} onChange={updateBanner} />
          <input name="href" placeholder="/newsletter or /contact" value={bannerForm.href} onChange={updateBanner} />
          <button className="btn btn-primary">Save banner</button>
        </form>
      </section>

      <section className="admin-grid wide">
        <div className="admin-panel">
          <h2>Schedule manager</h2>
          <div className="admin-list">
            {(data?.events || []).map(event => (
              <article key={event.slug}>
                <div><b>{event.title}</b><span>{new Date(event.date).toLocaleString()} · {event.room}</span></div>
                <button className="btn btn-sm btn-ghost" onClick={() => removeEvent(event.slug)}>Remove</button>
              </article>
            ))}
          </div>
        </div>
        <div className="admin-panel">
          <h2>Contact messages</h2>
          <div className="admin-list messages">
            {(data?.messages || []).map(message => (
              <article key={message._id}>
                <div><b>{message.name}</b><span>{message.email} · {message.subject}</span><p>{message.message}</p></div>
                <button className="btn btn-sm btn-ghost" onClick={() => markRead(message._id)}>{message.status}</button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="admin-panel">
        <h2>Promotional letter signups</h2>
        <div className="subscriber-list">
          {(data?.subscribers || []).map(sub => <span key={sub._id}>{sub.email}</span>)}
        </div>
      </section>
    </main>
  );
}
