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
          <button className="burger" aria-label="Menu" aria-expanded={open}
                  onClick={() => setOpen(o => !o)}><span /></button>
        </div>
      </nav>
      <div className={'mobilemenu' + (open ? ' open' : '')}>
        {LINKS.map(([href, label]) => (
          <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>
        ))}
        <button className="btn btn-primary" style={{ marginTop: 18 }}
                onClick={() => { setOpen(false); onTickets('next'); }}>Get tickets</button>
      </div>
    </>
  );
}
