import Embers from './Embers.jsx';
import { useCountdown } from '../hooks/useCountdown.js';
import { money, pad } from '../utils.js';

export default function Hero({ event, count, onTickets }) {
  const cd = useCountdown(event?.date);
  const d = event ? new Date(event.date) : null;
  const soldFast = Boolean(event && event.sold > 60 && event.sold < 100);
  const goSignup = () => {
    if (event) return onTickets('next');
    window.history.pushState({}, '', '/newsletter');
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="hero" id="home">
      <Embers />
      <div className="hero-glow a" />
      <div className="hero-glow b" />
      <div className="hero-glow c" />

      <div className="wrap hero-body">
        <div className="hero-top">
          <span className="chip"><i className="dot" /> Latest event: August 28</span>
          <span className="chip">Muzique Nightclub · Montreal</span>
          <span className="chip">18+ · Doors 23:00</span>
        </div>
        <div className="hero-grid">
          <div>
            <h1 className="h-xl">
              <span className="line"><i>Nights that</i></span>
              <span className="line"><i className="grad-text">catch fire</i></span>
            </h1>
            <p className="lead">
              ISKRA is a spark, a room, and a sound system that refuses to behave. Raw techno,
              deep house and the residents who built this city's floor — every Friday and Saturday
              until the lights come up.
            </p>
            <div className="hero-cta">
              <button className="btn btn-primary" onClick={goSignup}>Join Promo List →</button>
              <a className="btn btn-ghost" href="/schedule">View Schedule</a>
            </div>
          </div>
          <div className="countdown">
            <div className="countdown-head">
              <div>
                <div className="eyebrow" style={{ margin: '0 0 6px' }}>{event ? 'Next up' : 'Last event'}</div>
                <b>{event ? event.title : 'Grand Opening'}</b>
              </div>
              <span className="chip">
                <i className="dot" /> {event ? (soldFast ? 'Selling fast' : 'On sale') : 'Recap live'}
              </span>
            </div>
            {/* Only count down to something. With no upcoming event the card is a
                recap, and the clock used to render "NaN" in every cell. */}
            {event && (
              <div className="cd-grid">
                <div className="cd-cell"><b>{pad(cd.days)}</b><span>Days</span></div>
                <div className="cd-cell"><b>{pad(cd.hrs)}</b><span>Hrs</span></div>
                <div className="cd-cell"><b>{pad(cd.min)}</b><span>Min</span></div>
                <div className="cd-cell"><b>{pad(cd.sec)}</b><span>Sec</span></div>
              </div>
            )}
            <div className="countdown-foot">
              <span>
                {d
                  ? `${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()} · ${event.room.toUpperCase()} · FROM ${money(event.from)}`
                  : '28 AUGUST · MUZIQUE NIGHTCLUB · MONTREAL'}
              </span>
              <button className="btn btn-sm btn-lime" onClick={goSignup}>{event ? 'Tickets' : 'Sign up'}</button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
