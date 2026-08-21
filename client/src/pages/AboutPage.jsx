import Nav from '../components/Nav.jsx';
import Footer from '../components/Footer.jsx';
import PromoBar from '../components/PromoBar.jsx';

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
            <div className="eyebrow">Project ISKRA · Montréal</div>
            <h1 className="h-xl">A night built around people.</h1>
            <div className="about-hero-foot">
              <p className="lead">
                Slavic energy, Montréal hospitality, and a room where strangers become the crowd.
              </p>
              <span className="about-scroll">Our story <i>↓</i></span>
            </div>
          </div>
        </section>

        <section className="section about-story">
          <div className="wrap about-story-grid">
            <div className="about-story-copy">
              <div className="eyebrow">Why we started</div>
              <h2 className="h-lg">More than a name on a flyer.</h2>
              <p className="about-pullquote">
                ISKRA means spark. For us, it is the exact moment a room stops feeling like a venue
                and starts feeling like it belongs to everyone in it.
              </p>
              <p>
                We started Project ISKRA to make social nights with care in every layer: the music,
                the welcome at the door, the people behind the bar, and the visual world around it.
                Each edition responds to its venue and its crowd. Nothing is copied and no schedule
                is announced before the night is ready.
              </p>
            </div>
            <figure className="about-story-image">
              <img src={photo('project_iskra_event 10.jpg')} alt="A Project ISKRA host welcoming guests at the door" loading="lazy" />
              <figcaption><span>01</span> The welcome starts before the music.</figcaption>
            </figure>
          </div>
        </section>

        <section className="about-gallery-section" aria-labelledby="about-gallery-title">
          <div className="wrap about-gallery-head">
            <div>
              <div className="eyebrow">Inside the last night</div>
              <h2 className="h-lg" id="about-gallery-title">This is ISKRA.</h2>
            </div>
            <p>Not staged. Not stock. Photographs from the people and places that made our first chapter.</p>
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
            <div className="eyebrow">What guides every night</div>
            <div className="about-principles-grid">
              <article>
                <span>01</span>
                <h3>The room</h3>
                <p>We choose spaces with character, then let their mood shape the night.</p>
              </article>
              <article>
                <span>02</span>
                <h3>The sound</h3>
                <p>Selectors who read a crowd, move with it, and never play on autopilot.</p>
              </article>
              <article>
                <span>03</span>
                <h3>The people</h3>
                <p>A warm door, an open floor, and a crowd that makes room for one another.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="about-invite">
          <img src={photo('project_iskra_event 18.jpg')} alt="Guests meeting outside a Project ISKRA event" loading="lazy" />
          <div className="about-invite-shade" />
          <div className="wrap about-invite-copy">
            <div className="eyebrow">The next chapter</div>
            <h2 className="h-lg">Come as you are.<br />Leave part of the story.</h2>
            <div className="about-invite-actions">
              <a className="btn btn-primary" href="/newsletter">Join the guest list</a>
              <a className="about-text-link" href="/contact">Work with us <span>↗</span></a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
