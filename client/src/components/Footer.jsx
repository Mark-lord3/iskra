import Logo from './Logo.jsx';
import { SITE } from '../site.js';

const NIGHTS = [['/schedule','Schedule'], ['/offers','Offers'], ['/play','Play for tickets']];
const VISIT  = [['/about','About us'], ['/contact','Contact'], ['/newsletter','Mailing list']];

export default function Footer() {
  const socials = Object.entries(SITE.social).filter(([, url]) => url);

  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <a href="/" className="logo" style={{ marginBottom: 16 }}><Logo id="lg2" />ISKRA</a>
            <p className="lead" style={{ fontSize: 14, maxWidth: '30ch' }}>
              {SITE.address}<br />{SITE.hours}<br />Be decent to each other.
            </p>
          </div>

          <div>
            <h5>Nights</h5>
            <ul>{NIGHTS.map(([h, l]) => <li key={l}><a href={h}>{l}</a></li>)}</ul>
          </div>

          <div>
            <h5>Visit</h5>
            <ul>
              {VISIT.map(([h, l]) => <li key={l}><a href={h}>{l}</a></li>)}
              <li><a href={`mailto:${SITE.email}`}>{SITE.email}</a></li>
            </ul>
          </div>

          <div>
            <h5>Follow</h5>
            {socials.length > 0 ? (
              <ul>
                {socials.map(([name, url]) => (
                  <li key={name}>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {name[0].toUpperCase() + name.slice(1)}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              // Nothing is linked until real URLs are added to src/site.js,
              // so the footer never ships a dead link.
              <p className="lead" style={{ fontSize: 13 }}>Social links go in <code>src/site.js</code>.</p>
            )}
          </div>
        </div>

        <div className="foot-bottom">
          <span>{new Date().getFullYear()} ISKRA. All nights reserved.</span>
          <span>{SITE.address}</span>
        </div>
      </div>
    </footer>
  );
}
