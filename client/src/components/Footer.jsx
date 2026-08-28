import Logo from './Logo.jsx';
import { SITE } from '../site.js';
import {useI18n} from '../i18n.jsx';

const NIGHTS = [['/schedule','nav.schedule'], ['/offers','nav.offers'], ['/play','footer.play']];
const VISIT  = [['/about','footer.about'], ['/gallery','nav.gallery'], ['/tickets','nav.tickets'], ['/contact','nav.contact'], ['/newsletter','footer.list'], ['/terms','footer.terms']];

export default function Footer() {
  const {t}=useI18n();
  const socials = Object.entries(SITE.social).filter(([, url]) => url);

  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <a href="/" className="logo" style={{ marginBottom: 16 }}><Logo id="lg2" />ISKRA</a>
            <p className="lead" style={{ fontSize: 14, maxWidth: '30ch' }}>
              {SITE.address}<br />{SITE.hours}<br />{t('footer.decent')}
            </p>
          </div>

          <div>
            <h5>{t('footer.nights')}</h5>
            <ul>{NIGHTS.map(([h,key]) => <li key={key}><a href={h}>{t(key)}</a></li>)}</ul>
          </div>

          <div>
            <h5>{t('footer.visit')}</h5>
            <ul>
              {VISIT.map(([h,key]) => <li key={key}><a href={h}>{t(key)}</a></li>)}
            </ul>
          </div>

          <div>
            <h5>{t('footer.follow')}</h5>
            {socials.length > 0 ? (
              <ul>
                <li><a href="/partners">{t('nav.partners')}</a></li>
                {socials.map(([name, url]) => (
                  <li key={name}>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {name}
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
          <span>© 2026 {t('footer.rights')}</span>
          <span>{t('footer.developed')} <a href="https://orvadora.com" target="_blank" rel="noopener noreferrer">Orvadora</a></span>
        </div>
      </div>
    </footer>
  );
}
