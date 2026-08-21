import Photo from './Photo.jsx';

/* PLACEHOLDER plates. Swap each for a real photograph of the matching space. */
const SPACES = [
  ['room-mainhall',  'Main Hall',    '1,200 capacity, Funktion-One'],
  ['room-basement',  'The Basement', '250 capacity, vinyl only'],
  ['room-terrace',   'Terrace',      'Open till four'],
  ['room-barnord',   'Bar Nord',     'Natural wine and cheap beer'],
  ['room-booth',     'The Booth',    'Four Technics, Xone:96'],
  ['room-cloakroom', 'Cloakroom',    'Free before midnight']
];

export default function Venue() {
  return (
    <section className="section" id="venue" style={{ paddingInline: 0 }}>
      <div className="wrap">
        <div className="sec-head">
          <h2 className="h-lg rv">Concrete, smoke, bass</h2>
          <p className="lead rv">
            A former turbine hall on the river. Two floors, one obsessive sound engineer,
            and a terrace that has ended more friendships than it started.
          </p>
        </div>
      </div>

      <div className="rail rv">
        {SPACES.map(([seed, name, meta]) => (
          <div className="rail-item" key={seed}>
            <Photo plate={seed} alt={name} hover />
            <div className="rail-cap"><b>{name}</b><span>{meta}</span></div>
          </div>
        ))}
      </div>
    </section>
  );
}
