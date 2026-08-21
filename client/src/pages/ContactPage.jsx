import { useState } from 'react';
import { api } from '../api.js';
import Footer from '../components/Footer.jsx';
import Nav from '../components/Nav.jsx';
import PromoBar from '../components/PromoBar.jsx';
import { useToast } from '../components/Toasts.jsx';

export default function ContactPage({ onTickets }) {
  const toast = useToast();
  const [form, setForm] = useState({ name:'', email:'', subject:'Booking / promotion', message:'' });
  const [busy, setBusy] = useState(false);

  const update = e => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.contact({ ...form, path:location.pathname });
      setForm({ name:'', email:'', subject:'Booking / promotion', message:'' });
      toast('Message sent. The ISKRA team will reply from the inbox.', 'OK');
    } catch (err) { toast(err.message, '!'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <PromoBar />
      <Nav onTickets={onTickets} />
      <main>
        <section className="page-hero contact-hero">
          <div className="wrap">
            <div className="eyebrow">Contact</div>
            <h1 className="h-xl">Talk to the team.</h1>
            <p className="lead">Bookings, birthdays, table requests, brand partnerships, media, and venue ideas.</p>
          </div>
        </section>
        <section className="section">
          <div className="wrap contact-grid">
            <form className="contact-form card" onSubmit={submit}>
              <label><span>Name</span><input name="name" value={form.name} onChange={update} required /></label>
              <label><span>Email</span><input name="email" type="email" value={form.email} onChange={update} required /></label>
              <label><span>Subject</span><input name="subject" value={form.subject} onChange={update} /></label>
              <label><span>Message</span><textarea name="message" value={form.message} onChange={update} required rows="7" /></label>
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Sending' : 'Send message'}</button>
            </form>
            <aside className="contact-aside">
              <h2 className="h-md">For promotion offers</h2>
              <p>Use the form and mention your group size, date, and preferred venue area. Messages appear in the admin inbox.</p>
              <div className="contact-poster">
                <img src="/last-event/grand-opening-poster.png" alt="Project Iskra grand opening poster" />
              </div>
            </aside>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

