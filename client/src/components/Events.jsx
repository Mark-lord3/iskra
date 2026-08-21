import { useState } from 'react';
import Photo from './Photo.jsx';
import { money, pad } from '../utils.js';

const FILTERS = [['all','All'],['techno','Techno'],['house','House'],['live','Live'],['free','Free entry']];
const BADGE = { hot: 'Selling fast', new: 'Just announced' };

export default function Events({ events, onTickets }) {
  const [filter, setFilter] = useState('all');
  const visible = events.filter(e => filter === 'all' || e.tags.includes(filter));

  return (
    <section className="section" id="events">
      <div className="wrap">
        <div className="sec-head sec-bar">
          <h2 className="h-lg rv">Upcoming nights</h2>
          <div className="filters rv">
            {FILTERS.map(([f, label]) => (
              <button key={f} className={'filter' + (filter === f ? ' on' : '')}
                      onClick={() => setFilter(f)}>{label}</button>
            ))}
          </div>
        </div>

        {visible.length === 0 && (
          <p className="lead rv">Nothing on sale in that category yet. Try another filter.</p>
        )}

        <div className="events">
          {visible.map(e => {
            const d = new Date(e.date);
            const out = e.sold >= 100;
            return (
              <article key={e.id} className={'event rv' + (out ? ' soldout' : '')}>
                <Photo seed={e.id} w={640} h={400} hover={!out} alt={e.title} className="ev-photo">
                  <div className="ev-day">
                    {pad(d.getDate())}
                    <small>{d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}</small>
                  </div>
                </Photo>

                <div className="ev-main">
                  <h3>{e.title}</h3>
                  <p className="ev-support">{e.support}</p>
                  <div className="ev-meta">
                    {e.badges.map(b => <span key={b} className="tag tag-ember">{BADGE[b]}</span>)}
                    <span className="tag">{d.toLocaleDateString('en-GB', { weekday: 'long' })}</span>
                    <span className="tag">{pad(d.getHours())}:{pad(d.getMinutes())} till 06:00</span>
                    <span className="tag">{e.room}</span>
                    {e.tags.map(t => <span key={t} className="tag">{t}</span>)}
                  </div>
                </div>

                <div className="ev-side">
                  <div className="ev-price">
                    {out ? <b>Sold out</b> : (
                      <div>
                        <b>{e.from === 0 ? 'Free' : money(e.from)}</b>
                        {e.was ? <s>{money(e.was)}</s> : null}
                      </div>
                    )}
                    <span>{out ? 'Nothing left' : e.sold > 60 ? `${e.sold}% gone` : 'On sale now'}</span>
                    {!out && <div className="ev-bar"><i style={{ width: e.sold + '%' }} /></div>}
                  </div>
                  <button className={'btn btn-sm ' + (out ? 'btn-ghost' : 'btn-primary')}
                          disabled={out} onClick={() => onTickets(e.id)}>
                    {out ? 'Sold out' : 'Get tickets'}
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
