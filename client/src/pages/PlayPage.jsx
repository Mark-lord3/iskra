import Footer from '../components/Footer.jsx';
import Nav from '../components/Nav.jsx';
import GameHub from '../components/GameHub.jsx';
import Play from '../components/Play.jsx';
import PromoBar from '../components/PromoBar.jsx';

/**
 * The arcade section is the opening of this page: the old text hero was
 * replaced by the entrance sequence, so there is no second heading above it.
 */
export default function PlayPage({ onTickets, onReward, hub = false }) {
  return (
    <>
      <PromoBar />
      <Nav onTickets={onTickets} />
      <main>
        {hub ? <GameHub /> : <Play onTickets={onTickets} onReward={onReward} />}
      </main>
      <Footer />
    </>
  );
}
