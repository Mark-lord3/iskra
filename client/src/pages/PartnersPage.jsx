import Footer from '../components/Footer.jsx';
import Nav from '../components/Nav.jsx';
import PromoBar from '../components/PromoBar.jsx';
import { useI18n } from '../i18n.jsx';

/* Both creators are described with exactly what they supplied: a name, a
   handle and one line about their work. No figures or claims are added. */
const CREATORS = [
  {
    name:'Glory Molly Prod + KiddyGold82',
    nameLines:['Glory Molly Prod','KiddyGold82'],
    profiles:[
      { handle:'@glorymollyprod', url:'https://www.instagram.com/glorymollyprod/' },
      { handle:'@kiddygold82', url:'https://www.instagram.com/kiddygold82/' }
    ],
    image:'/partners/creators/glorymollyprod-kiddygold82.jpg',
    copyKey:'partners.gloryCopy',
    altKey:'partners.gloryAlt',
    // Keeps both collaborators visible inside the circular crop.
    focus:'50% 48%'
  },
  {
    name:'Migrant Shop',
    nameLines:['Migrant Shop'],
    profiles:[
      { handle:'@migrant.shop', url:'https://www.instagram.com/migrant.shop/' }
    ],
    image:'/partners/creators/migrant-shop.jpg',
    copyKey:'partners.migrantCopy',
    altKey:'partners.migrantAlt',
    focus:'50% 50%'
  }
];

export default function PartnersPage({ onTickets }) {
  const { t } = useI18n();

  return <>
    <PromoBar />
    <Nav onTickets={onTickets} />
    <main className="partners-page partners-v2">
      <section className="partners-v2-hero">
        <div className="wrap partners-v2-hero-grid">
          <div className="partners-v2-intro">
            <p>PROJECT ISKRA / PARTNERS</p>
            <h1>{t('partners.title')}</h1>
            <span>{t('partners.lead')}</span>
          </div>
          <div className="partners-v2-collage" aria-label="Project ISKRA partner identities">
            <figure className="partners-v2-collage-main"><img src="/partners/orvadora-lockup.png" alt="Orvadora digital solutions" /></figure>
            <figure className="partners-v2-collage-top"><img src="/partners/muzique-enhanced.jpg" alt="Muzique Montréal" /></figure>
            <figure className="partners-v2-collage-bottom"><img src="/partners/ukrainian-montreal.jpg" alt={t('partners.communityTitle')} /></figure>
          </div>
        </div>
        <div className="partners-v2-strip" aria-hidden="true"><span>TECHNOLOGY / NIGHTLIFE / COMMUNITY / MONTRÉAL / TECHNOLOGY / NIGHTLIFE / COMMUNITY / MONTRÉAL /</span></div>
      </section>

      <section className="partners-v2-orvadora">
        <div className="wrap partners-v2-orvadora-grid">
          <div className="partners-v2-orvadora-visual">
            <img className="partners-v2-orvadora-campaign" src="/partners/orvadora-system.png" alt="Orvadora digital systems campaign artwork" loading="lazy" />
          </div>
          <div className="partners-v2-copy">
            <p className="partner-role">{t('partners.orvadoraRole')}</p>
            <h2>ORVADORA</h2>
            <p className="partner-statement">{t('partners.orvadoraCopy')}</p>
            <ul>
              <li>{t('partners.orvadoraWeb')}</li>
              <li>{t('partners.orvadoraOps')}</li>
              <li>{t('partners.orvadoraRights')}</li>
            </ul>
            <a className="partner-link" href="https://orvadora.com" target="_blank" rel="noopener noreferrer">{t('partners.visitOrvadora')} <span>↗</span></a>
          </div>
        </div>
      </section>

      <section className="partners-v2-creators">
        <div className="wrap">
          <header className="partners-creators-head">
            <p>{t('partners.creatorsRole')}</p>
            <h2>{t('partners.creatorsTitle')}</h2>
            <span>{t('partners.creatorsLead')}</span>
          </header>
          <ul className="partners-creators-grid">
            {CREATORS.map((creator, index) => (
              <li key={creator.name} className="partner-creator" style={{ '--i': index }}>
                <article className="partner-creator-link">
                  {/* Ring and portrait share one box, so they stay concentric
                      at every width instead of drifting into separate cells. */}
                  <a className="partner-creator-avatar" href={creator.profiles[0].url}
                     target="_blank" rel="noopener noreferrer" aria-label={creator.profiles[0].handle}>
                      <span className="partner-creator-ring" aria-hidden="true" />
                      <span className="partner-creator-photo">
                        <img src={creator.image} alt={t(creator.altKey)} loading="lazy"
                             width="900" height="900" style={{ objectPosition: creator.focus }} />
                      </span>
                  </a>
                  <b className="partner-creator-name">
                    {creator.nameLines.map((line) => <span key={line}>{line}</span>)}
                  </b>
                  <span className="partner-creator-handles mono">
                    {creator.profiles.map((profile) => (
                      <a key={profile.handle} href={profile.url} target="_blank"
                         rel="noopener noreferrer">{profile.handle}</a>
                    ))}
                  </span>
                  <span className="partner-creator-copy">{t(creator.copyKey)}</span>
                  <span className="partner-creator-actions">
                    {creator.profiles.map((profile) => (
                      <a className="partner-creator-cta" key={profile.handle} href={profile.url}
                         target="_blank" rel="noopener noreferrer">
                        {t('partners.viewInstagram')}
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
                          <circle cx="12" cy="12" r="4" />
                          <circle cx="17.2" cy="6.8" r="1.2" className="dot" />
                        </svg>
                        <i aria-hidden="true">↗</i>
                      </a>
                    ))}
                  </span>
                  {/* Each row below is its own grid track: name, handle, then
                      the description on a flexible track and the call to action
                      last. The flexible track absorbs the difference between a
                      short line and a long one, so the buttons stay level
                      however the copy is translated. */}
                </article>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="partners-v2-muzique">
        <div className="wrap partners-v2-muzique-grid">
          <figure><img src="/partners/muzique-enhanced.jpg" alt={t('partners.muziqueAlt')} loading="lazy" /></figure>
          <div>
            <p>{t('partners.venueRole')}</p>
            <h2>MUZIQUE<br />MONTRÉAL</h2>
            <span>{t('partners.venueCopy')}</span>
            <a className="partners-v2-dark-link" href="https://www.instagram.com/muziquemontreal/" target="_blank" rel="noopener noreferrer">Instagram <b>↗</b></a>
          </div>
        </div>
      </section>

      <section className="partners-v2-community">
        <div className="wrap partners-v2-community-grid">
          <figure><img src="/partners/ukrainian-montreal.jpg" alt={t('partners.communityTitle')} loading="lazy" /></figure>
          <div className="partners-v2-community-copy">
            <p>{t('partners.communityRole')}</p>
            <h2>{t('partners.communityTitle')}</h2>
            <span>{t('partners.communityCopy')}</span>
            <a href="https://t.me/montrealukrainians" target="_blank" rel="noopener noreferrer">Open Telegram <b>↗</b></a>
          </div>
        </div>
      </section>


      <section className="partners-v2-wellness">
        <div className="wrap partners-wellness-grid">
          {/* Purpose-built digital artwork rather than the photographed card. */}
          <figure className="partners-wellness-art">
            <img src="/partners/magic-hands-abstract.png" alt={t('partners.wellnessAlt')}
                 width="900" height="600" loading="lazy" />
          </figure>

          <div className="partners-wellness-copy">
            <p className="partners-wellness-role mono">{t('partners.wellnessRole')}</p>
            <h2>MAGIC HANDS</h2>
            <p className="partners-wellness-tagline">{t('partners.wellnessTagline')}</p>
            <p className="partners-wellness-person">
              <span className="mono">{t('partners.wellnessPractitioner')}</span>
              <b>Sergii Karnaukh</b>
            </p>
            <span className="partners-wellness-body">{t('partners.wellnessCopy')}</span>
            <p className="partners-wellness-motto">{t('partners.wellnessMotto')}</p>
          </div>
        </div>
      </section>
    </main>
    <Footer />
  </>;
}
