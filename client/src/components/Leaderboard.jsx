import { pad } from '../utils.js';

export default function Leaderboard({ board, me, attemptsLeft, hasPlayer, onReset }) {
  const inTop = me && board.some(r => r.id === me.id);

  return (
    <div className="board rv">
      <div className="board-head">
        <h3>Leaderboard</h3>
        <span>Top 5 win</span>
      </div>

      <div className="lb">
        {board.length === 0 && (
          <p className="mono" style={{ fontSize: 12, color: 'var(--dim)' }}>No scores yet. Be the first.</p>
        )}
        {board.map(row => (
          <div key={row.id}
               className={'lb-row' + (row.rank <= 5 ? ' win' : '') + (me && row.id === me.id ? ' me' : '')}>
            <div className="lb-rank">{pad(row.rank)}</div>
            <div>
              <div className="lb-name">{row.handle}</div>
              <div className="lb-prize">{me && row.id === me.id ? 'You' : row.prize}</div>
            </div>
            <div className="lb-score">{row.score.toLocaleString()}</div>
          </div>
        ))}
        {me && !inTop && (
          <div className="lb-row me" style={{ marginTop: 8 }}>
            <div className="lb-rank">{pad(me.rank)}</div>
            <div><div className="lb-name">{me.handle}</div><div className="lb-prize">You</div></div>
            <div className="lb-score">{me.score.toLocaleString()}</div>
          </div>
        )}
      </div>

      <div className="board-foot">
        <div>{hasPlayer ? `${attemptsLeft} of 3 attempts left today` : 'Sign up to take your three attempts'}</div>
        <div>Season closes 20 September. Ties go to the earliest score.</div>
        {hasPlayer && (
          <div><button className="link-button" onClick={onReset}>Sign out on this device</button></div>
        )}
      </div>
    </div>
  );
}
