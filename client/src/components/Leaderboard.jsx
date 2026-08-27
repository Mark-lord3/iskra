import { useI18n } from '../i18n.jsx';
import { pad } from '../utils.js';

const fmtWhen = (iso, locale) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short' }) + ' ' +
         d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
};

function Row({ row, me, label }) {
  const mine = me && row.id === me.id;
  return (
    <div className={'lb-row' + (row.tier ? ' win' : '') + (mine ? ' me' : '')}>
      <div className="lb-rank">{pad(row.rank)}</div>
      <div className="lb-id">
        {/* React escapes this, so a display name can never inject markup. */}
        <div className="lb-name">{row.handle}</div>
        <div className="lb-when">{mine ? label.you : fmtWhen(row.achievedAt, label.locale)}</div>
      </div>
      <div className="lb-score">{row.score.toLocaleString()}</div>
    </div>
  );
}

/**
 * Live board. Every row comes from the API: there is no seeded or placeholder
 * player anywhere in this component.
 */
export default function Leaderboard({ board, me, status, online, onRetry, updatedAt }) {
  const { t, locale } = useI18n();
  const label = { you: t('arcade.you'), locale };

  return (
    <aside className="board" aria-label={t('arcade.liveBoard')}>
      <div className="board-head">
        <h3>{t('arcade.liveBoard')}</h3>
        {updatedAt && status === 'ready' && (
          <span className="board-stamp">{t('arcade.updated')} {fmtWhen(updatedAt, locale)}</span>
        )}
      </div>

      {!online && <p className="board-note board-note-warn">{t('arcade.offline')}</p>}

      {status === 'loading' && (
        <div className="lb lb-skeleton" aria-busy="true" aria-live="polite">
          <span className="sr-only">{t('common.loading')}</span>
          {Array.from({ length: 6 }, (_, i) => <div className="lb-ghost" key={i} />)}
        </div>
      )}

      {status === 'error' && (
        <div className="board-state">
          <p className="board-note board-note-warn">{t('arcade.boardError')}</p>
          <button className="btn btn-ghost btn-sm" onClick={onRetry}>{t('arcade.retry')}</button>
        </div>
      )}

      {status === 'ready' && board.length === 0 && (
        <div className="board-state">
          <p className="board-empty-title">{t('arcade.boardEmpty')}</p>
          <p className="board-note">{t('arcade.boardEmptyCopy')}</p>
        </div>
      )}

      {status === 'ready' && board.length > 0 && (
        <div className="lb">
          {board.map(row => <Row key={row.id} row={row} me={me} label={label} />)}
          {me && !me.inTop && me.rank && (
            <>
              <div className="lb-split" aria-hidden="true">···</div>
              <Row row={me} me={me} label={label} />
            </>
          )}
          {me && !me.rank && (
            <>
              <div className="lb-split" aria-hidden="true">···</div>
              <div className="lb-row me">
                <div className="lb-rank">--</div>
                <div className="lb-id">
                  <div className="lb-name">{me.handle}</div>
                  <div className="lb-when">{t('arcade.unranked')}</div>
                </div>
                <div className="lb-score">0</div>
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
