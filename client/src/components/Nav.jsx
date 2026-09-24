import { useEffect, useRef, useState } from 'react';
import Logo from './Logo.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import { datingUrl } from '../site.js';
import {useI18n} from '../i18n.jsx';

const LINKS = [
  ['/schedule','nav.schedule'],['/gallery','nav.gallery'],['/offers','nav.offers'],['/play','nav.play'],
  ['/about','nav.about'],['/partners','nav.partners'],['/contact','nav.contact'],['/donate','nav.donate'],[datingUrl(),'nav.dating'],['/account','nav.account']
];

export default function Nav({ onTickets }) {
  const {t}=useI18n();
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);
  const sentinel = useRef(null);

  // A sentinel above the nav rather than a scroll listener: no work on the
  // main thread for every scroll frame.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // With the menu open the page behind it must not scroll, Escape must close
  // it, and a rotate to landscape must not leave it stranded over the content.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    const onResize = () => { if (window.innerWidth > 1400) setOpen(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  return (
    <>
      <div ref={sentinel} aria-hidden="true" style={{ position:'absolute', top:0, height:12, width:'100%' }} />
      <nav className={'nav' + (stuck ? ' stuck' : '')}>
        <div className="wrap">
          <a href="/" className="logo"><Logo />ISKRA</a>
          <div className="navlinks">
            {LINKS.map(([href, key]) => <a key={href} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}>{t(key)}</a>)}
          </div>
          <LanguageSwitcher />
          <button className="btn btn-primary btn-sm" onClick={() => onTickets('next')}>{t('nav.getTickets')}</button>
          <button className={'burger' + (open ? ' open' : '')}
                  aria-label={open ? t('nav.close') : t('nav.open')}
                  aria-expanded={open} aria-controls="mobilemenu"
                  onClick={() => setOpen(o => !o)}><span /></button>
        </div>

        <div id="mobilemenu" className={'mobilemenu' + (open ? ' open' : '')}>
          <LanguageSwitcher className="language-switcher-mobile" />
          {LINKS.map(([href, key]) => (
            <a key={href} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noopener noreferrer' : undefined} onClick={() => setOpen(false)}>{t(key)}</a>
          ))}
          <button className="btn btn-primary" style={{ marginTop: 18 }}
                  onClick={() => { setOpen(false); onTickets('next'); }}>{t('nav.getTickets')}</button>
        </div>
      </nav>
    </>
  );
}
