const ITEMS = [
  ['1.2K', 'Capacity'],
  ['112dB', 'Funktion-One rig'],
  ['06:00', 'Last record'],
  ['48', 'Nights a year']
];

export default function Stats() {
  return (
    <section className="section" style={{ paddingBlock: 'clamp(40px,5vw,64px)' }}>
      <div className="wrap">
        <div className="stats rv">
          {ITEMS.map(([value, label]) => (
            <div key={label} className="stat">
              <b>{value}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
