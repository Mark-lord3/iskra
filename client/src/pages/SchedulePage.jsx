import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Events from '../components/Events.jsx';
import Footer from '../components/Footer.jsx';
import Nav from '../components/Nav.jsx';
import PromoBar from '../components/PromoBar.jsx';
import {useReveal} from '../hooks/useReveal.js';
import {useI18n} from '../i18n.jsx';

const MOCK_SLUGS = new Set([
  'closing-vera-ostrov',
  'blackout-nadia-volkov',
  'deep-end-marlo-pace',
  'resident-series-014',
  'iskra-vs-kontur',
  'ember-live-machines',
  'sunset-to-sunrise'
]);

export default function SchedulePage({ onTickets }) {
  const {t}=useI18n();
  const [events, setEvents] = useState([]);
  useReveal([events.length]);

  useEffect(() => {
    api.events().then(data => {
      const upcoming = data.filter(e => new Date(e.date) > Date.now() && !MOCK_SLUGS.has(e.slug || e.id));
      setEvents(upcoming);
    }).catch(() => setEvents([]));
  }, []);

  return (
    <>
      <PromoBar />
      <Nav onTickets={onTickets} />
      <main>
        <section className="page-hero schedule-hero">
          <div className="wrap">
            <div className="eyebrow">{t('schedule.eyebrow')}</div>
            <h1 className="h-xl">{t('schedule.title')}</h1>
            <p className="lead">{t('schedule.lead')}</p>
          </div>
        </section>
        {events.length ? (
          <Events events={events} onTickets={onTickets} />
        ) : (
          <section className="section">
            <div className="wrap empty-schedule">
              <img src="/last-event/project_iskra_event.jpg" alt={t('home.photoAlt',{number:1})} />
              <div>
                <span className="tag tag-ember">{t('schedule.latest')}</span>
                <h2 className="h-lg">{t('schedule.empty')}</h2>
                <p className="lead">{t('schedule.emptyCopy')}</p>
                <a className="btn btn-primary" href="/newsletter">{t('common.joinList')}</a>
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
