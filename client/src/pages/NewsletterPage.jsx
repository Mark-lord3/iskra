import { useEffect, useRef, useState } from 'react';
import CosmicField from '../components/CosmicField.jsx';
import Footer from '../components/Footer.jsx';
import AmbienceToggle from '../components/AmbienceToggle.jsx';
import Nav from '../components/Nav.jsx';
import PromoBar from '../components/PromoBar.jsx';
import SignalForm from '../components/SignalForm.jsx';
import { useI18n } from '../i18n.jsx';

const RECEIVE = [
  ['nl.r1','nl.r1c','spark'],  ['nl.r2','nl.r2c','plasma'], ['nl.r3','nl.r3c','volt'],
  ['nl.r4','nl.r4c','acid'],   ['nl.r5','nl.r5c','spark']
];
const TIMELINE = [
  ['nl.tl1','nl.tl1c','nl.tlNow',   'is-first'],
  ['nl.tl2','nl.tl2c','nl.tlLater', ''],
  ['nl.tl3','nl.tl3c','nl.tlLast',  '']
];

/** Live-looking telemetry that stays cheap: one interval, no per-frame state. */
function Telemetry() {
  const { t } = useI18n();
  const [signal, setSignal] = useState(86);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setSignal(s => Math.max(72, Math.min(99, s + (Math.random() * 8 - 4)))), 2200);
    return () => clearInterval(id);
  }, []);
  const bars = Math.round(signal / 20);
  return (
    <dl className="tele" aria-label={t('nl.signal')}>
      <div><dt>{t('nl.signal')}</dt>
        <dd><span className="tele-bars" aria-hidden="true">
          {[0,1,2,3,4].map(i => <i key={i} className={i < bars ? 'on' : ''} />)}
        </span>{Math.round(signal)}%</dd></div>
      <div><dt>{t('nl.channel')}</dt><dd className="tele-live">{t('nl.live')}</dd></div>
      <div><dt>{t('nl.coords')}</dt><dd>45.5088 N · 73.5878 W</dd></div>
      <div><dt>{t('nl.freq')}</dt><dd>101.9 MHz</dd></div>
    </dl>
  );
}

export default function NewsletterPage({ onTickets }) {
  const { t } = useI18n();
  const heroRef = useRef(null);
  const [density, setDensity] = useState(1);

  // Fewer craft and particles on small screens, decided once per breakpoint.
  useEffect(() => {
    const set = () => setDensity(innerWidth < 560 ? 0.45 : innerWidth < 1024 ? 0.7 : 1);
    set();
    addEventListener('resize', set, { passive: true });
    return () => removeEventListener('resize', set);
  }, []);

  return (
    <>
      <PromoBar />
      <Nav onTickets={onTickets} />
      <main className="nl-page">
        <a className="skip-to-form" href="#signal-form">{t('nl.skipToForm')}</a>

        {/* ---------- hero transmission ---------- */}
        <section className="nl-hero" ref={heroRef}>
          <CosmicField density={density} />
          <div className="nl-hero-veil" aria-hidden="true" />
          <div className="wrap nl-hero-grid">
            <div className="nl-hero-copy">
              <p className="nl-incoming mono">
                <span className="nl-incoming-dot" aria-hidden="true" />{t('nl.incoming')}
              </p>
              <h1 className="nl-title interference" data-text={t('nl.title')}>{t('nl.title')}</h1>
              <p className="lead nl-lead">{t('nl.lead')}</p>
            </div>

            {/* The form sits in its own lit panel so nothing ever flies over it. */}
            <div className="nl-form-panel" id="signal-form">
              <div className="nl-form-glow" aria-hidden="true" />
              <SignalForm />
            </div>

            {/* Telemetry follows the form on small screens so the email field
                stays within the first viewport. */}
            <div className="nl-tele-wrap"><Telemetry /><AmbienceToggle /></div>
          </div>
        </section>

        {/* ---------- intercepted transmissions ---------- */}
        <section className="section nl-receive">
          <div className="wrap">
            <h2 className="nl-h2 interference" data-text={t('nl.receiveTitle')}>{t('nl.receiveTitle')}</h2>
            <p className="lead nl-sub">{t('nl.receiveLead')}</p>
            <ul className="nl-intercepts">
              {RECEIVE.map(([title, copy, tone], i) => (
                <li className={`nl-intercept tone-${tone}`} key={title}>
                  <span className="nl-int-id mono" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')} / {t('nl.channel')}
                  </span>
                  <h3>{t(title)}</h3>
                  <p>{t(copy)}</p>
                  <span className="nl-wave" aria-hidden="true">
                    {Array.from({ length: 22 }, (_, k) => <i key={k} style={{ '--k': k }} />)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- signal timeline ---------- */}
        <section className="section nl-timeline-sec">
          <div className="wrap">
            <h2 className="nl-h2">{t('nl.timelineTitle')}</h2>
            <p className="lead nl-sub">{t('nl.timelineLead')}</p>
            <ol className="nl-timeline">
              {TIMELINE.map(([title, copy, when, cls]) => (
                <li className={`nl-tl ${cls}`} key={title}>
                  <span className="nl-tl-when mono">{t(when)}</span>
                  <span className="nl-tl-node" aria-hidden="true" />
                  <h3>{t(title)}</h3>
                  <p>{t(copy)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- private channel, then a gradual fade into the footer ---------- */}
        <section className="section nl-private">
          <div className="wrap nl-private-grid">
            <div>
              <h2 className="nl-h2">{t('nl.privateTitle')}</h2>
              <p className="lead">{t('nl.privateCopy')}</p>
            </div>
            <SignalForm compact source="newsletter-private" />
          </div>
          <div className="nl-atmosphere" aria-hidden="true" />
        </section>
      </main>
      <Footer />
    </>
  );
}
