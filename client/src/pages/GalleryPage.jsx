import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Footer from '../components/Footer.jsx';
import Nav from '../components/Nav.jsx';
import PromoBar from '../components/PromoBar.jsx';
import partyPhotos from '../data/party-2026-08-28.json';
import {useI18n} from '../i18n.jsx';

const FALLBACK = [14,8,3,12,20,27,1,5,10,23,26].map((number,index)=>({
  id:`fallback-${number}`,
  url:`/last-event/${encodeURIComponent(`project_iskra_event ${number}.jpg`)}`,
  alt:`Project ISKRA event moment ${index + 1}`
}));

export default function GalleryPage({onTickets}){
  const {t}=useI18n();
  const [limit,setLimit] = useState(24);
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
        <div className="wrap">
          <h2 className="h-lg">28.08.2026 · Project ISKRA</h2>
          <p className="lead">{t('gallery.photoCredit')} · avanesianpro · {partyPhotos.length} {t('gallery.photos')}</p>
          <div className="gallery-page-grid">
            {partyPhotos.slice(0,limit).map((item,index) => <figure key={item.id} className={index % 5 === 0 ? 'gallery-feature' : ''}>
              <a href={item.url} target="_blank" rel="noopener noreferrer" data-native-link>
                <img src={item.url} alt={t('gallery.partyAlt',{number:index+1})} loading={index < 3 ? 'eager' : 'lazy'} decoding="async" />
              </a>
              <figcaption><span>{String(index+1).padStart(2,'0')}</span>{t('gallery.partyAlt',{number:index+1})}</figcaption>
            </figure>)}
          </div>
          {limit < partyPhotos.length && <button type="button" className="btn btn-ghost" onClick={()=>setLimit(n=>n+24)}>{t('gallery.more')} ({partyPhotos.length-limit})</button>}
          <h2 className="h-lg gallery-archive-title">{t('gallery.archive')}</h2>
          <div className="gallery-page-grid">
          {items.map((item,index)=>(
            <figure key={item.id || item.url} className={index % 5 === 0 ? 'gallery-feature' : ''}>
              <img src={item.url} alt={item.id?.startsWith('fallback') ? t('gallery.alt',{number:index+1}) : item.alt} loading={index < 3 ? 'eager' : 'lazy'} />
              <figcaption><span>{String(index+1).padStart(2,'0')}</span>{item.id?.startsWith('fallback') ? t('gallery.alt',{number:index+1}) : item.alt}</figcaption>
            </figure>
          ))}
          </div>
        </div>
      </section>
    </main>
    <Footer />
  </>;
}
