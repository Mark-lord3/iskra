const WORDS = ['Techno', 'House', 'Live machines', 'Funktion-One', 'Doors 23:00',
               'No phones on the floor', 'Open till six'];

export default function Marquee() {
  const run = [...WORDS, ...WORDS];
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {run.map((w, i) => (
          <span key={i} className={i % 3 === 1 ? 'hot' : ''}>{w}</span>
        ))}
      </div>
    </div>
  );
}
