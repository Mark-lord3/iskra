import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Events from '../components/Events.jsx';
import Footer from '../components/Footer.jsx';
import Nav from '../components/Nav.jsx';
import PromoBar from '../components/PromoBar.jsx';

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
  const [events, setEvents] = useState([]);

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
            <div className="eyebrow">Schedule</div>
            <h1 className="h-xl">Next nights post here.</h1>
            <p className="lead">The public page shows only schedule items the team is ready to promote.</p>
          </div>
        </section>
        {events.length ? (
          <Events events={events} onTickets={onTickets} />
        ) : (
          <section className="section">
            <div className="wrap empty-schedule">
              <img src="/last-event/grand-opening-poster.png" alt="Project Iskra grand opening poster" />
              <div>
                <span className="tag tag-ember">Latest event</span>
                <h2 className="h-lg">New schedule coming soon.</h2>
                <p className="lead">The grand opening was August 28 at Muzique. Join the promo list for the next announcement.</p>
                <a className="btn btn-primary" href="/newsletter">Join promo list</a>
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
