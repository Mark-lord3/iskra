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
  return (
    <section className="section last-event" id="last-event">
      <div className="wrap">
        <div className="sec-head sec-bar">
          <div>
            <div className="eyebrow">Latest ISKRA night</div>
            <h2 className="h-lg rv">Grand opening at Muzique</h2>
            <p className="lead rv">
              August 28 was the first public spark: DJ MLNK, Slavic Music, and a full room at
              3781 Boulevard Saint-Laurent. The next schedule will be posted by the team from admin.
            </p>
          </div>
          <a className="btn btn-ghost" href="/schedule">View schedule</a>
        </div>

        <div className="last-event-grid rv">
          <figure className="poster-panel">
            <img src="/last-event/grand-opening-poster.png" alt="Project Iskra grand opening poster" />
          </figure>
          <div className="event-memory">
            <div className="memory-copy">
              <span className="chip">28 August · Muzique Nightclub</span>
              <h3>Last event, first signal.</h3>
              <p>
                Real photos from the room now carry the site. No mock future lineups on the landing page:
                the public schedule stays quiet until an admin posts the next night.
              </p>
              <a className="btn btn-primary" href="/newsletter">Join promo list</a>
            </div>
            <div className="memory-photos">
              {PHOTOS.slice(1,7).map((name, index) => (
                <img key={name} src={srcFor(name)} alt={`Project Iskra event photo ${index + 1}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
