import { useEffect, useState } from 'react';
import { REDUCED } from '../utils.js';
import { api } from '../api.js';
import {useI18n} from '../i18n.jsx';

const MESSAGE_KEYS=['promo.first','promo.wallet','promo.groups','promo.gallery'];

export default function PromoBar() {
  const {t,language}=useI18n();
  const [open, setOpen] = useState(true);
  const [i, setI] = useState(0);
  const [custom, setCustom] = useState('');

  useEffect(() => {
    api.siteStatus().then(status=>setCustom(status.message || (status.open === false ? t('promo.paused') : ''))).catch(()=>{});
  }, [language]);

  const localized=MESSAGE_KEYS.map(key=>t(key));
  const messages = custom ? [custom,...localized] : localized;

  useEffect(() => {
    if (REDUCED) return;
    const id = setInterval(() => setI(n => (n + 1) % messages.length), 4200);
    return () => clearInterval(id);
  }, [messages.length]);

  if (!open) return null;
  return (
    <div className="promobar">
      <div className="wrap">
        <div className="promobar-rot" aria-live="polite">
          {messages.map((m, n) => (
            <span key={m} className={n === i ? 'on' : ''}>{m}</span>
          ))}
        </div>
        <button className="promobar-x" onClick={() => setOpen(false)} aria-label={t('common.dismiss')}>×</button>
      </div>
    </div>
  );
}
