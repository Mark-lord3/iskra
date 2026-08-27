import Nav from '../components/Nav.jsx';
import Footer from '../components/Footer.jsx';
import PromoBar from '../components/PromoBar.jsx';
import {useI18n} from '../i18n.jsx';

const photo = name => `/last-event/${encodeURIComponent(name)}`;

const GALLERY = [
  { file: 'project_iskra_event 14.jpg', alt: 'Guests gathering inside the warmly lit Project ISKRA venue', className: 'about-gallery-wide' },
  { file: 'project_iskra_event 8.jpg', alt: 'Two guests talking on the terrace during Project ISKRA', className: 'about-gallery-tall' },
  { file: 'project_iskra_event 3.jpg', alt: 'DJ greeting the camera from the Project ISKRA booth', className: 'about-gallery-small' },
  { file: 'project_iskra_event 12.jpg', alt: 'Guests reflected in the lights at Project ISKRA', className: 'about-gallery-small' },
  { file: 'project_iskra_event 20.jpg', alt: 'Friends sharing a table near the bar at Project ISKRA', className: 'about-gallery-wide' },
  { file: 'project_iskra_event 27.jpg', alt: 'Project ISKRA hosts together at the venue', className: 'about-gallery-tall' }
];

export default function AboutPage({ onTickets }) {
  const {t}=useI18n();
  return (
    <>
      <PromoBar />
      <Nav onTickets={onTickets} />
      <main>
        <section className="about-hero">
          <img
            className="about-hero-photo"
            src={photo('project_iskra_event 1.jpg')}
            alt="Guests arriving at a Project ISKRA night"
          />
          <div className="about-hero-shade" />
          <div className="wrap about-hero-content">
            <div className="eyebrow">{t('about.kicker')}</div>
            <h1 className="h-xl">{t('about.title')}</h1>
            <div className="about-hero-foot">
              <p className="lead">
                {t('about.lead')}
              </p>
              <span className="about-scroll">{t('about.story')} <i>↓</i></span>
            </div>
          </div>
        </section>

        <section className="section about-story">
          <div className="wrap about-story-grid">
            <div className="about-story-copy">
              <div className="eyebrow">{t('about.why')}</div>
              <h2 className="h-lg">{t('about.flyer')}</h2>
              <p className="about-pullquote">{t('about.spark')}</p>
              <p>{t('about.copy')}</p>
            </div>
            <figure className="about-story-image">
              <img src={photo('project_iskra_event 10.jpg')} alt="A Project ISKRA host welcoming guests at the door" loading="lazy" />
              <figcaption><span>01</span> {t('about.welcome')}</figcaption>
            </figure>
          </div>
        </section>

        <section className="about-gallery-section" aria-labelledby="about-gallery-title">
          <div className="wrap about-gallery-head">
            <div>
              <div className="eyebrow">{t('about.inside')}</div>
              <h2 className="h-lg" id="about-gallery-title">{t('about.this')}</h2>
            </div>
            <p>{t('about.real')}</p>
          </div>
          <div className="wrap about-gallery">
            {GALLERY.map(({ file, alt, className }, index) => (
              <figure className={className} key={file}>
                <img src={photo(file)} alt={alt} loading="lazy" />
                <span>{String(index + 1).padStart(2, '0')}</span>
              </figure>
            ))}
          </div>
        </section>

        <section className="section about-principles">
          <div className="wrap">
            <div className="eyebrow">{t('about.guides')}</div>
            <div className="about-principles-grid">
              <article>
                <span>01</span>
                <h3>{t('about.room')}</h3>
                <p>{t('about.roomCopy')}</p>
              </article>
              <article>
                <span>02</span>
                <h3>{t('about.sound')}</h3>
                <p>{t('about.soundCopy')}</p>
              </article>
              <article>
                <span>03</span>
                <h3>{t('about.people')}</h3>
                <p>{t('about.peopleCopy')}</p>
              </article>
            </div>
          </div>
        </section>

        <section className="about-invite">
          <img src={photo('project_iskra_event 18.jpg')} alt="Guests meeting outside a Project ISKRA event" loading="lazy" />
          <div className="about-invite-shade" />
          <div className="wrap about-invite-copy">
            <div className="eyebrow">{t('about.next')}</div>
            <h2 className="h-lg">{t('about.invite').split('\n').map((line,index)=><span key={line}>{line}{index===0&&<br />}</span>)}</h2>
            <div className="about-invite-actions">
              <a className="btn btn-primary" href="/newsletter">{t('about.guest')}</a>
              <a className="about-text-link" href="/contact">{t('about.work')} <span>↗</span></a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
