import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Newsletter from './Newsletter.jsx';
import {useI18n} from '../i18n.jsx';

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
  const {t}=useI18n();
  const [banners, setBanners] = useState(FALLBACK);

  useEffect(() => {
    api.banners().then(data => setBanners(data.length ? data : FALLBACK)).catch(() => {});
  }, []);

  const localizedFallback=[
    {title:t('newsletter.presale'),text:t('newsletter.presaleCopy'),cta:t('common.joinList'),href:'/newsletter'},
    {title:t('newsletter.birthday'),text:t('newsletter.birthdayCopy'),cta:t('newsletter.offers'),href:'/newsletter'}
  ];
  const shown=banners === FALLBACK ? localizedFallback : banners;
  return (
    <section className="section promo-signup" id="newsletter">
      <div className="wrap">
        <div className="banner-grid rv">
          {shown.slice(0, 2).map((banner) => (
            <article className="signup-banner" key={banner.id || banner.title}>
              <span className="tag tag-ember">{t('newsletter.promotion')}</span>
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
