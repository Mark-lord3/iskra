import { useEffect } from 'react';
import { useI18n } from '../i18n.jsx';

/**
 * Shown when "Get tickets" is pressed while no event is on sale. Without this
 * the button silently did nothing, which reads as a broken site.
 */
export default function NoSaleModal({ onClose }) {
  const { t } = useI18n();

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const go = href => { onClose(); history.pushState({}, '', href); dispatchEvent(new PopStateEvent('popstate')); };

  return (
    <div className="modal open" role="dialog" aria-modal="true" aria-labelledby="nosale-title"
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-in nosale">
        <div className="modal-head">
          <h3 id="nosale-title">{t('sale.noneTitle')}</h3>
          <button className="x" onClick={onClose} aria-label={t('checkout.close')}>×</button>
        </div>
        <p className="lead nosale-copy">{t('sale.noneCopy')}</p>
        <div className="nosale-actions">
          <button className="btn btn-primary" onClick={() => go('/newsletter')}>{t('sale.joinList')}</button>
          <button className="btn btn-ghost" onClick={() => go('/schedule')}>{t('sale.seeSchedule')}</button>
        </div>
      </div>
    </div>
  );
}
