import { useCallback, useEffect, useState } from 'react';
import { ToastProvider } from './components/Toasts.jsx';
import PromoBar from './components/PromoBar.jsx';
import Nav from './components/Nav.jsx';
import Hero from './components/Hero.jsx';
import Marquee from './components/Marquee.jsx';
import Stats from './components/Stats.jsx';
import LastEvent from './components/LastEvent.jsx';
import Footer from './components/Footer.jsx';
import TicketModal from './components/TicketModal.jsx';
import AboutPage from './pages/AboutPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import ContactPage from './pages/ContactPage.jsx';
import NewsletterPage from './pages/NewsletterPage.jsx';
import OffersPage from './pages/OffersPage.jsx';
import PlayPage from './pages/PlayPage.jsx';
import SchedulePage from './pages/SchedulePage.jsx';
import { api } from './api.js';
import { useReveal } from './hooks/useReveal.js';
import { nextEvent } from './utils.js';

const path = () => window.location.pathname.replace(/\/$/, '') || '/';

export default function App() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [ticketFor, setTicketFor] = useState(null);
  const [rewardCode, setRewardCode] = useState(null);
  const [route, setRoute] = useState(path());

  useEffect(() => {
    api.events().then(setEvents).catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    const onClick = e => {
      const anchor = e.target.closest?.('a[href]');
      const button = e.target.closest?.('button');
      const href = anchor?.getAttribute('href');

      if(anchor && href?.startsWith('/')) {
        e.preventDefault();
        window.history.pushState({}, '', href);
        setRoute(path());
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      if(anchor || button) {
        api.track({
          type:'click',
          path:location.pathname,
          label:anchor?.textContent?.trim() || button?.textContent?.trim() || ''
        }).catch(() => {});
      }
    };
    const onPop = () => setRoute(path());
    document.addEventListener('click', onClick);
    window.addEventListener('popstate', onPop);
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  useEffect(() => {
    api.track({ type:'visit', path:route, referrer:document.referrer }).catch(() => {});
  }, [route]);

  useReveal([events, route]);

  const openTickets = useCallback(id => setTicketFor(id), []);
  const onSale = events.filter(e => e.sold < 100 && new Date(e.date) > Date.now()).length;
  const modalEvent = ticketFor === 'next' ? nextEvent(events) : events.find(e => e.id === ticketFor);

  const routed = {
    '/about': <AboutPage onTickets={openTickets} />,
    '/contact': <ContactPage onTickets={openTickets} />,
    '/newsletter': <NewsletterPage onTickets={openTickets} />,
    '/offers': <OffersPage onTickets={openTickets} />,
    '/play': <PlayPage onTickets={openTickets} onReward={setRewardCode} />,
    '/schedule': <SchedulePage onTickets={openTickets} />,
    '/admin': <AdminPage />
  }[route];

  if (routed) {
    return (
      <ToastProvider>
        {routed}
        {modalEvent && (
          <TicketModal event={modalEvent} presetCode={rewardCode} onClose={() => setTicketFor(null)} />
        )}
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <PromoBar />
      <Nav onTickets={openTickets} />
      <Hero event={null} count={onSale} onTickets={openTickets} />
      <Marquee />
      <Stats />

      {error && (
        <div className="wrap" style={{ paddingBottom: 40 }}>
          <div className="card" style={{ padding:20, borderColor:'rgba(255,107,107,.4)' }}>
            <b className="mono" style={{ fontSize:12, color:'#ff6b6b' }}>API UNREACHABLE. {error}</b>
            <p className="lead" style={{ fontSize:14, marginTop:8 }}>
              Start the backend with <code>npm run dev</code> from the project root.
            </p>
          </div>
        </div>
      )}

      <LastEvent onTickets={openTickets} />
      <Footer />

      {modalEvent && (
        <TicketModal event={modalEvent} presetCode={rewardCode} onClose={() => setTicketFor(null)} />
      )}
    </ToastProvider>
  );
}
