import { useEffect, useRef, useState } from 'react';
import Logo from './Logo.jsx';

const LINKS = [
  ['/schedule', 'Schedule'], ['/offers', 'Offers'], ['/play', 'Play for Tickets'],
  ['/about', 'About'], ['/contact', 'Contact']
];

export default function Nav({ onTickets }) {
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
    const onResize = () => { if (window.innerWidth > 860) setOpen(false); };
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
            {LINKS.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => onTickets('next')}>Get tickets</button>
          <button className={'burger' + (open ? ' open' : '')}
                  aria-label={open ? 'Close menu' : 'Open menu'}
                  aria-expanded={open} aria-controls="mobilemenu"
                  onClick={() => setOpen(o => !o)}><span /></button>
        </div>
      </nav>
      <div id="mobilemenu" className={'mobilemenu' + (open ? ' open' : '')}>
        {LINKS.map(([href, label]) => (
          <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>
        ))}
        <button className="btn btn-primary" style={{ marginTop: 18 }}
                onClick={() => { setOpen(false); onTickets('next'); }}>Get tickets</button>
      </div>
    </>
  );
}
