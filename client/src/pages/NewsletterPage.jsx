import Footer from '../components/Footer.jsx';
import Nav from '../components/Nav.jsx';
import PromoBar from '../components/PromoBar.jsx';
import PromoSignupBanners from '../components/PromoSignupBanners.jsx';

export default function NewsletterPage({ onTickets }) {
  return (
    <>
      <PromoBar />
      <Nav onTickets={onTickets} />
      <main>
        <section className="page-hero newsletter-hero">
          <div className="wrap">
            <div className="eyebrow">Mailing list</div>
            <h1 className="h-xl">Get the next spark first.</h1>
            <p className="lead">Promo letters, early links, and private group offers from Project ISKRA.</p>
          </div>
        </section>
        <PromoSignupBanners />
      </main>
      <Footer />
    </>
  );
}

