import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Footer from '../components/Footer.jsx';
import Nav from '../components/Nav.jsx';
import PromoBar from '../components/PromoBar.jsx';
import {useI18n} from '../i18n.jsx';

const FALLBACK = [14,8,3,12,20,27,1,5,10,18,23,26].map((number,index)=>({
  id:`fallback-${number}`,
  url:`/last-event/${encodeURIComponent(`project_iskra_event ${number}.jpg`)}`,
  alt:`Project ISKRA event moment ${index + 1}`
}));

export default function GalleryPage({onTickets}){
  const {t}=useI18n();
  const [items,setItems] = useState(FALLBACK);
  useEffect(()=>{
    api.gallery().then(data=>{ if(data.length) setItems(data); }).catch(()=>{});
  },[]);

  return <>
    <PromoBar />
    <Nav onTickets={onTickets} />
    <main>
      <section className="page-hero gallery-hero">
        <div className="wrap">
          <div className="eyebrow">{t('gallery.eyebrow')}</div>
          <h1 className="h-xl">{t('gallery.title')}</h1>
          <p className="lead">{t('gallery.lead')}</p>
        </div>
      </section>
      <section className="section gallery-page-section">
        <div className="wrap gallery-page-grid">
          {items.map((item,index)=>(
            <figure key={item.id || item.url} className={index % 5 === 0 ? 'gallery-feature' : ''}>
              <img src={item.url} alt={item.id?.startsWith('fallback') ? t('gallery.alt',{number:index+1}) : item.alt} loading={index < 3 ? 'eager' : 'lazy'} />
              <figcaption><span>{String(index+1).padStart(2,'0')}</span>{item.id?.startsWith('fallback') ? t('gallery.alt',{number:index+1}) : item.alt}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </main>
    <Footer />
  </>;
}
