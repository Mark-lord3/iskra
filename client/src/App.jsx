import { useCallback, useEffect, useRef, useState } from 'react';
import { ToastProvider } from './components/Toasts.jsx';
import PromoBar from './components/PromoBar.jsx';
import Nav from './components/Nav.jsx';
import Events from './components/Events.jsx';
import Hero from './components/Hero.jsx';
import Marquee from './components/Marquee.jsx';
import Stats from './components/Stats.jsx';
import LastEvent from './components/LastEvent.jsx';
import Footer from './components/Footer.jsx';
import TicketModal from './components/TicketModal.jsx';
import NoSaleModal from './components/NoSaleModal.jsx';
import AboutPage from './pages/AboutPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import ContactPage from './pages/ContactPage.jsx';
import NewsletterPage from './pages/NewsletterPage.jsx';
import OffersPage from './pages/OffersPage.jsx';
import PlayPage from './pages/PlayPage.jsx';
import SchedulePage from './pages/SchedulePage.jsx';
import GalleryPage from './pages/GalleryPage.jsx';
import StaffScanPage from './pages/StaffScanPage.jsx';
import TicketsPage from './pages/TicketsPage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import PartnersPage from './pages/PartnersPage.jsx';
import PokerPage from './pages/PokerPage.jsx';
import DonatePage from './pages/DonatePage.jsx';
import TermsPage from './pages/TermsPage.jsx';
import ConsentCampaign from './components/ConsentCampaign.jsx';
import Seo from './components/Seo.jsx';
import { api } from './api.js';
import { useReveal } from './hooks/useReveal.js';
import { nextEvent } from './utils.js';

const path = () => window.location.pathname.replace(/\/$/, '') || '/';

export default function App() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [ticketFor, setTicketFor] = useState(null);
  const [rewardCode, setRewardCode] = useState(null);
  const [ticketQty, setTicketQty] = useState(null);
  const [route, setRoute] = useState(path());
  const checkoutLinkHandled=useRef(false);

  useEffect(() => {
    api.events().then(setEvents).catch(e => setError(e.message));
  }, []);

  useEffect(()=>{
    if(checkoutLinkHandled.current||!events.length)return;
    const params=new URLSearchParams(location.search);
    const event=params.get('event'),promo=params.get('promo');
    if(!event||!promo)return;
    checkoutLinkHandled.current=true;setRewardCode(promo.toUpperCase());setTicketFor(event);setTicketQty(1);
  },[events]);

  useEffect(() => {
    const onClick = e => {
      const anchor = e.target.closest?.('a[href]');
      const button = e.target.closest?.('button');
      const href = anchor?.getAttribute('href');

      if(anchor && href?.startsWith('/') && !anchor.hasAttribute('data-native-link') && !anchor.target && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
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

  // A code may travel with the request so "apply at checkout" can open the
  // ticket flow with the campaign already filled in.
  const openTickets = useCallback((id, code, qty) => {
    setTicketFor(id);
    if (code) setRewardCode(code);
    // An offer can arrive with a suggested quantity, so checkout opens ready
    // to use the code rather than below its minimum.
    setTicketQty(qty || null);
  }, []);
  const onSale = events.filter(e => e.sold < 100 && new Date(e.endsAt||e.date) > Date.now()).length;
  const modalEvent = ticketFor === 'next' ? nextEvent(events) : events.find(e => e.id === ticketFor);

  const pokerRoute = route === '/play/poker' || route.startsWith('/play/poker/')
    ? <PokerPage route={route} onTickets={openTickets} /> : null;
  const routed = pokerRoute || {
    '/about': <AboutPage onTickets={openTickets} />,
    '/contact': <ContactPage onTickets={openTickets} />,
    '/newsletter': <NewsletterPage onTickets={openTickets} />,
    '/offers': <OffersPage onTickets={openTickets} />,
    '/play': <PlayPage onTickets={openTickets} onReward={setRewardCode} hub />,
    '/play/spark-rush': <PlayPage onTickets={openTickets} onReward={setRewardCode} />,
    '/schedule': <SchedulePage onTickets={openTickets} />,
    '/gallery': <GalleryPage onTickets={openTickets} />,
    '/tickets': <TicketsPage onTickets={openTickets} />,
    '/account': <AccountPage />,
    '/partners': <PartnersPage onTickets={openTickets} />,
    '/donate': <DonatePage onTickets={openTickets} />,
    '/terms': <TermsPage onTickets={openTickets} />,
    '/staff/scan': <StaffScanPage />,
    // The old admin-key scanner URL keeps working, pointing at the staff route.
    '/admin/scan': <StaffScanPage />,
    '/admin': <AdminPage />
  }[route];

  if (routed) {
    return (
      <ToastProvider>
        <Seo route={route} events={events} />
        {routed}
        <ConsentCampaign />
        {ticketFor && !modalEvent && <NoSaleModal onClose={() => setTicketFor(null)} />}
        {modalEvent && (
          <TicketModal event={modalEvent} presetCode={rewardCode} presetQty={ticketQty} onClose={() => setTicketFor(null)} />
        )}
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <Seo route={route} events={events} />
      <ConsentCampaign />
      <PromoBar />
      <Nav onTickets={openTickets} />
      <Hero event={events.find(e=>new Date(e.endsAt||e.date)>new Date())||null} count={onSale} onTickets={openTickets} />
      <Events events={events.filter(e=>new Date(e.endsAt||e.date)>new Date())} onTickets={openTickets} />
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

      {ticketFor && !modalEvent && <NoSaleModal onClose={() => setTicketFor(null)} />}
      {modalEvent && (
        <TicketModal event={modalEvent} presetCode={rewardCode} presetQty={ticketQty} onClose={() => setTicketFor(null)} />
      )}
    </ToastProvider>
  );
}
