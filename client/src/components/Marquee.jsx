import {useI18n} from '../i18n.jsx';

export default function Marquee() {
  const {t}=useI18n();
  const WORDS = ['Techno','House',t('marquee.machines'),'Funktion-One',t('marquee.doors'),t('marquee.phones'),t('marquee.six')];
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {[0, 1].map(group => (
          <div className="marquee-run" key={group}>
            {WORDS.map((word, index) => (
              <span key={`${group}-${index}`} className={index % 3 === 1 ? 'hot' : ''}>{word}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
