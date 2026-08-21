import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Newsletter from './Newsletter.jsx';

const FALLBACK = [
  {
    title:'Presale codes before Instagram',
    text:'Join the list and get the first ticket window before the poster goes public.',
    cta:'Join the list',
    href:'/newsletter'
  },
  {
    title:'Birthday and group tables',
    text:'Leave your email and we will send private offers for birthdays, crews, and early arrivals.',
    cta:'Get offers',
    href:'/newsletter'
  }
];

export default function PromoSignupBanners() {
  const [banners, setBanners] = useState(FALLBACK);

  useEffect(() => {
    api.banners().then(data => setBanners(data.length ? data : FALLBACK)).catch(() => {});
  }, []);

  return (
    <section className="section promo-signup" id="newsletter">
      <div className="wrap">
        <div className="banner-grid rv">
          {banners.slice(0, 2).map((banner) => (
            <article className="signup-banner" key={banner.id || banner.title}>
              <span className="tag tag-ember">Promotion</span>
              <h3>{banner.title}</h3>
              <p>{banner.text}</p>
              <a className="btn btn-ghost btn-sm" href={banner.href}>{banner.cta}</a>
            </article>
          ))}
        </div>
        <Newsletter />
      </div>
    </section>
  );
}
