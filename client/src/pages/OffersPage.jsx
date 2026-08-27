import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import Footer from '../components/Footer.jsx';
import Nav from '../components/Nav.jsx';
import PromoBar from '../components/PromoBar.jsx';
import PromoSignupBanners from '../components/PromoSignupBanners.jsx';
import { useToast } from '../components/Toasts.jsx';
import { useReveal } from '../hooks/useReveal.js';
import { useI18n } from '../i18n.jsx';

/* Each campaign kind gets its own treatment and its own photograph, so the page
   reads as an editorial spread rather than a row of identical cards. */
const KIND = {
  early:    { photo:'/nightlife/offers-early.jpg',    altKey:'of.altEarly',    accent:'spark'  },
  group:    { photo:'/nightlife/offers-group.jpg',    altKey:'of.altGroup',    accent:'plasma' },
  resident: { photo:'/nightlife/offers-resident.jpg', altKey:'of.altResident', accent:'volt'   },
  table:    { photo:'/nightlife/offers-table.jpg',    altKey:'of.altTable',    accent:'acid'   },
  reward:   { photo:'/nightlife/offers-spark.jpg',    altKey:'of.altSpark',    accent:'acid'   }
};

export default function OffersPage({ onTickets }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [status, setStatus] = useState('loading');   // loading | ready | error
  const [copied, setCopied] = useState(null);

  // Campaigns arrive after the route-level reveal pass. Observe again whenever
  // the API result changes so returning to Offers cannot leave cards invisible.
  useReveal([status, campaigns.length]);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await api.promoPublic();
      setCampaigns(data.campaigns || []);
      setStatus('ready');
    } catch { setStatus('error'); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // One analytics event per page view, alongside the existing route tracking.
  useEffect(() => {
    if (status !== 'ready') return;
    api.track({ type:'offers_view', path:location.pathname, label:String(campaigns.length) }).catch(() => {});
  }, [status, campaigns.length]);

  const fmt = iso => iso ? new Date(iso).toLocaleDateString(locale, { day:'numeric', month:'long' }) : '';

  const copy = async c => {
    if (c.status !== 'live') return;                 // expired codes cannot be copied
    try { await navigator.clipboard.writeText(c.code); } catch { /* clipboard blocked */ }
    setCopied(c.code);
    setTimeout(() => setCopied(k => (k === c.code ? null : k)), 2600);
    toast(t('of.copied'), '✦');
    api.track({ type:'promo_copy', path:location.pathname, label:c.code }).catch(() => {});
  };

  const applyAtCheckout = c => {
    if (c.status !== 'live') return;
    api.track({ type:'promo_checkout', path:location.pathname, label:c.code }).catch(() => {});
    onTickets?.('next', c.code, c.minQty);           // opens at the campaign minimum
  };

  const go = href => { history.pushState({}, '', href); dispatchEvent(new PopStateEvent('popstate')); };

  return (
    <>
      <PromoBar />
      <Nav onTickets={onTickets} />
      <main className="offers-page">

        {/* ---------- campaign hero ---------- */}
        <section className="of-hero">
          <img className="of-hero-photo" src="/nightlife/offers-hero.jpg" alt={t('of.altHero')}
               width="1920" height="1280" fetchpriority="high" />
          <div className="of-hero-shade" aria-hidden="true" />
          <div className="wrap of-hero-body">
            <p className="of-kicker mono">{t('of.kicker')}</p>
            <h1 className="of-title">{t('of.title')}</h1>
            <p className="lead of-lead">{t('of.lead')}</p>
            <ol className="of-how">
              <li><span className="mono">01</span>{t('of.how1')}</li>
              <li><span className="mono">02</span>{t('of.how2')}</li>
              <li><span className="mono">03</span>{t('of.how3')}</li>
            </ol>
          </div>
        </section>

        {/* ---------- live campaigns ---------- */}
        <section className="section of-campaigns">
          <div className="wrap">
            <p className="of-server-note mono">{t('of.serverNote')}</p>

            {status === 'loading' && (
              <div className="of-list" aria-busy="true">
                <span className="sr-only">{t('of.loading')}</span>
                {[0,1,2].map(i => <div className="of-skeleton" key={i} />)}
              </div>
            )}

            {status === 'error' && (
              <div className="of-state">
                <p className="of-state-title">{t('of.error')}</p>
                <button className="btn btn-ghost btn-sm" onClick={load}>{t('of.retry')}</button>
              </div>
            )}

            {status === 'ready' && campaigns.length === 0 && (
              <div className="of-state">
                <p className="of-state-title">{t('of.empty')}</p>
                <p className="lead">{t('of.emptyCopy')}</p>
                <button className="btn btn-primary btn-sm" onClick={() => go('/newsletter')}>
                  {t('newsletter.offers')}
                </button>
              </div>
            )}

            {status === 'ready' && campaigns.length > 0 && (
              <div className="of-list">
                {campaigns.map((c, i) => {
                  const k = KIND[c.kind] || KIND.early;
                  const live = c.status === 'live';
                  return (
                    <article key={c.code}
                             className={`of-item of-${c.kind} ${i % 2 ? 'flip' : ''} ${live ? '' : 'is-off'} rv`}>
                      <figure className="of-item-photo">
                        <img src={k.photo} alt={t(k.altKey)} width="1200" height="800" loading="lazy" />
                      </figure>

                      <div className="of-item-body">
                        <div className="of-item-top">
                          <span className={`of-badge of-badge-${k.accent}`}>{t('of.kind.' + c.kind)}</span>
                          <span className={`of-status of-status-${c.status}`}>{t('of.status.' + c.status)}</span>
                        </div>

                        <p className="of-discount">
                          {c.flatPrice ? `$${c.flatPrice}` : t('of.off').replace('{percent}', c.percentOff)}
                        </p>
                        <h2 className="of-item-title">{c.label}</h2>

                        <ul className="of-meta">
                          <li>{t('of.limit').replace('{count}', c.minQty)}</li>
                          <li>{c.appliesTo === 'all' ? t('of.allEvents') : c.appliesTo}</li>
                          {c.expiresAt && <li>{t('of.until').replace('{date}', fmt(c.expiresAt))}</li>}
                          {c.status === 'scheduled' && c.startsAt &&
                            <li>{t('of.from').replace('{date}', fmt(c.startsAt))}</li>}
                        </ul>

                        {!live && <p className="of-off-note">{t('of.expiredNote')}</p>}

                        <div className="of-actions">
                          <button className="of-code" onClick={() => copy(c)} disabled={!live}
                                  aria-label={`${t('of.copy')} ${c.code}`}>
                            <span className="of-code-text">{c.code}</span>
                            <span className="of-code-cta">{copied === c.code ? t('of.copied') : t('of.copy')}</span>
                          </button>
                          <button className="btn btn-primary btn-sm" onClick={() => applyAtCheckout(c)} disabled={!live}>
                            {t('of.apply')}
                          </button>
                        </div>
                        {/* Announces the copy result without stealing focus. */}
                        <span className="sr-only" role="status">
                          {copied === c.code ? `${t('of.copied')}: ${c.code}` : ''}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ---------- private offers + spark rush, side by side ---------- */}
        <section className="section of-split-sec">
          <div className="wrap of-split">
            <article className="of-panel of-panel-table rv">
              <figure><img src="/nightlife/offers-table.jpg" alt={t('of.altTable')}
                           width="1000" height="667" loading="lazy" /></figure>
              <div>
                <span className="of-badge of-badge-acid">{t('of.kind.table')}</span>
                <h2 className="of-panel-title">{t('of.privateTitle')}</h2>
                <p>{t('of.privateCopy')}</p>
                <button className="btn btn-ghost btn-sm" onClick={() => go('/contact')}>
                  {t('of.privateCta')}
                </button>
              </div>
            </article>

            <article className="of-panel of-panel-spark rv">
              <figure><img src="/nightlife/offers-spark.jpg" alt={t('of.altSpark')}
                           width="800" height="533" loading="lazy" /></figure>
              <div>
                <span className="of-badge of-badge-volt">{t('of.kind.reward')}</span>
                <h2 className="of-panel-title">{t('of.sparkTitle')}</h2>
                <p>{t('of.sparkCopy')}</p>
                <button className="btn btn-ghost btn-sm" onClick={() => go('/play')}>
                  {t('of.sparkCta')}
                </button>
              </div>
            </article>
          </div>
        </section>

        <PromoSignupBanners />
      </main>
      <Footer />
    </>
  );
}
