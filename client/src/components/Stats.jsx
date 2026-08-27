import {useI18n} from '../i18n.jsx';

const ITEMS = [['1.2K','stats.capacity'],['112dB','stats.rig'],['06:00','stats.record'],['48','stats.nights']];

export default function Stats() {
  const {t}=useI18n();
  return (
    <section className="section" style={{ paddingBlock: 'clamp(40px,5vw,64px)' }}>
      <div className="wrap">
        <div className="stats rv">
          {ITEMS.map(([value,key]) => (
            <div key={key} className="stat">
              <b>{value}</b>
              <span>{t(key)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
