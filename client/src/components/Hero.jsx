import Embers from './Embers.jsx';
import { useCountdown } from '../hooks/useCountdown.js';
import { money, pad } from '../utils.js';
import {useI18n} from '../i18n.jsx';

export default function Hero({ event, count, onTickets }) {
  const {t,formatDate}=useI18n();
  const cd = useCountdown(event?.startsAt||event?.date);
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
          <span className="chip"><i className="dot" /> {event?formatDate(event.date,{day:'numeric',month:'long'}):t('home.latest')}</span>
          <span className="chip">{event?event.room:t('home.venue')}</span>
          <span className="chip">{event?'22:00 — 03:00':t('home.doors')}</span>
        </div>
        <div className="hero-grid">
          <div>
            <h1 className={event?"h-xl hero-event-title":"h-xl"}>
              <span className="line"><i>{event?event.title.split(' + ')[0]:t('home.title1')}</i></span>
              <span className="line"><i className="grad-text">{event?`+ ${event.title.split(' + ').slice(1).join(' + ')}`:t('home.title2')}</i></span>
            </h1>
            <p className="lead">
              {event?event.support:t('home.lead')}
            </p>
            <div className="hero-cta">
              <button className="btn btn-primary" onClick={goSignup}>{t(event?'nav.getTickets':'common.joinList')} →</button>
              <a className="btn btn-ghost" href="/schedule">{t('common.viewSchedule')}</a>
            </div>
          </div>
          <div className="countdown">
            <div className="countdown-head">
              <div>
                <div className="eyebrow" style={{ margin: '0 0 6px' }}>{event ? t('home.next') : t('home.lastEvent')}</div>
                <b>{event ? event.title : t('home.opening')}</b>
              </div>
              <span className="chip">
                <i className="dot" /> {event ? (soldFast ? t('home.selling') : t('home.sale')) : t('home.recap')}
              </span>
            </div>
            {/* Only count down to something. With no upcoming event the card is a
                recap, and the clock used to render "NaN" in every cell. */}
            {event && (
              <div className="cd-grid">
                <div className="cd-cell"><b>{pad(cd.days)}</b><span>{t('home.days')}</span></div>
                <div className="cd-cell"><b>{pad(cd.hrs)}</b><span>{t('home.hours')}</span></div>
                <div className="cd-cell"><b>{pad(cd.min)}</b><span>{t('home.minutes')}</span></div>
                <div className="cd-cell"><b>{pad(cd.sec)}</b><span>{t('home.seconds')}</span></div>
              </div>
            )}
            <div className="countdown-foot">
              <span>
                {d
                  ? `${formatDate(d,{weekday:'long',day:'numeric',month:'long'}).toUpperCase()} · ${event.room.toUpperCase()} · ${money(event.from)}`
                  : t('home.eventChip').toUpperCase()}
              </span>
              <button className="btn btn-sm btn-lime" onClick={goSignup}>{event ? t('nav.getTickets') : t('home.signup')}</button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
