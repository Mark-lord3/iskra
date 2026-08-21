import Footer from '../components/Footer.jsx';
import Nav from '../components/Nav.jsx';
import Play from '../components/Play.jsx';
import PromoBar from '../components/PromoBar.jsx';

export default function PlayPage({ onTickets, onReward }) {
  return (
    <>
      <PromoBar />
      <Nav onTickets={onTickets} />
      <main>
        <section className="page-hero play-hero-page">
          <div className="wrap">
            <div className="eyebrow">Play</div>
            <h1 className="h-xl">Win cheaper tickets.</h1>
            <p className="lead">Spark Rush stays on its own page, so the landing page can stay focused.</p>
          </div>
        </section>
        <Play onTickets={onTickets} onReward={onReward} />
      </main>
      <Footer />
    </>
  );
}

