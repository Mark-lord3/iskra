import Footer from '../components/Footer.jsx';
import Nav from '../components/Nav.jsx';
import PromoBar from '../components/PromoBar.jsx';
import PromoSignupBanners from '../components/PromoSignupBanners.jsx';
import Promos from '../components/Promos.jsx';

export default function OffersPage({ onTickets }) {
  return (
    <>
      <PromoBar />
      <Nav onTickets={onTickets} />
      <main>
        <section className="page-hero offers-hero">
          <div className="wrap">
            <div className="eyebrow">Offers</div>
            <h1 className="h-xl">Promos before the door.</h1>
            <p className="lead">Presale codes, group offers, birthday lists, and first-access drops.</p>
          </div>
        </section>
        <Promos onTickets={onTickets} />
        <PromoSignupBanners />
      </main>
      <Footer />
    </>
  );
}

