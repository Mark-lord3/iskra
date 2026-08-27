import { useState } from 'react';
import Photo from './Photo.jsx';
import { money, pad } from '../utils.js';
import {useI18n} from '../i18n.jsx';
import {useReveal} from '../hooks/useReveal.js';

const FILTERS = [['all','events.all'],['techno','events.techno'],['house','events.house'],['live','events.live'],['free','events.freeEntry']];
const BADGE = {hot:'events.hot',new:'events.new'};

export default function Events({ events, onTickets }) {
  const {t,formatDate}=useI18n();
  const [filter, setFilter] = useState('all');
  const visible = events.filter(e => filter === 'all' || e.tags.includes(filter));
  // Filtering unmounts cards. Observe the newly mounted cards each time so
  // they cannot remain at the reveal class's initial zero-opacity state.
  useReveal([filter, visible.map(event => event.id).join('|')]);

  return (
    <section className="section" id="events">
      <div className="wrap">
        <div className="sec-head sec-bar">
          <h2 className="h-lg rv">{t('events.title')}</h2>
          <div className="filters rv">
            {FILTERS.map(([f,key]) => (
              <button key={f} className={'filter' + (filter === f ? ' on' : '')}
                      onClick={() => setFilter(f)}>{t(key)}</button>
            ))}
          </div>
        </div>

        {visible.length === 0 && (
          <p className="lead rv">{t('events.empty')}</p>
        )}

        <div className="events">
          {visible.map(e => {
            const d = new Date(e.date);
            const out = e.sold >= 100;
            return (
              <article key={e.id} className={'event rv' + (out ? ' soldout' : '')}>
                <Photo src={e.image} seed={e.id} w={640} h={400} hover={!out} alt={e.title} className="ev-photo">
                  <div className="ev-day">
                    {pad(d.getDate())}
                    <small>{formatDate(d,{month:'short'}).toUpperCase()}</small>
                  </div>
                </Photo>

                <div className="ev-main">
                  <h3>{e.title}</h3>
                  <p className="ev-support">{e.support}</p>
                  <div className="ev-meta">
                    {e.badges.map(b => <span key={b} className="tag tag-ember">{t(BADGE[b] || b)}</span>)}
                    <span className="tag">{formatDate(d,{weekday:'long'})}</span>
                    <span className="tag">{pad(d.getHours())}:{pad(d.getMinutes())} {t('events.till')}</span>
                    <span className="tag">{e.room}</span>
                    {e.tags.map(t => <span key={t} className="tag">{t}</span>)}
                  </div>
                </div>

                <div className="ev-side">
                  <div className="ev-price">
                    {out ? <b>{t('events.soldOut')}</b> : (
                      <div>
                        <b>{e.from === 0 ? t('common.free') : money(e.from)}</b>
                        {e.was ? <s>{money(e.was)}</s> : null}
                      </div>
                    )}
                    <span>{out ? t('events.none') : e.sold > 60 ? t('events.gone',{percent:e.sold}) : t('events.now')}</span>
                    {!out && <div className="ev-bar"><i style={{ width: e.sold + '%' }} /></div>}
                  </div>
                  <button className={'btn btn-sm ' + (out ? 'btn-ghost' : 'btn-primary')}
                          disabled={out} onClick={() => onTickets(e.id)}>
                    {out ? t('events.soldOut') : t('events.tickets')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
