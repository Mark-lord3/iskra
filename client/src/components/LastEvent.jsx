import {useI18n} from '../i18n.jsx';

const PHOTOS = [
  'project_iskra_event.jpg',
  'project_iskra_event 1.jpg',
  'project_iskra_event 2.jpg',
  'project_iskra_event 3.jpg',
  'project_iskra_event 4.jpg',
  'project_iskra_event 5.jpg',
  'project_iskra_event 6.jpg',
  'project_iskra_event 7.jpg'
];

const srcFor = name => `/last-event/${encodeURIComponent(name)}`;

export default function LastEvent() {
  const {t}=useI18n();
  return (
    <section className="section last-event" id="last-event">
      <div className="wrap">
        <div className="sec-head sec-bar">
          <div>
            <div className="eyebrow">{t('home.eventEyebrow')}</div>
            <h2 className="h-lg rv">{t('home.eventTitle')}</h2>
            <p className="lead rv">{t('home.eventLead')}</p>
          </div>
          <a className="btn btn-ghost" href="/schedule">{t('common.viewSchedule')}</a>
        </div>

        <div className="last-event-grid rv">
          <figure className="poster-panel">
            <img src={srcFor(PHOTOS[0])} alt={t('home.photoAlt',{number:1})} />
          </figure>
          <div className="event-memory">
            <div className="memory-copy">
              <span className="chip">{t('home.eventChip')}</span>
              <h3>{t('home.eventSignal')}</h3>
              <p>{t('home.eventCopy')}</p>
              <a className="btn btn-primary" href="/newsletter">{t('common.joinList')}</a>
            </div>
            <div className="memory-photos">
              {PHOTOS.slice(1,7).map((name, index) => (
                <img key={name} src={srcFor(name)} alt={t('home.photoAlt',{number:index+2})} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
