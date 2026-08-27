import { useEffect, useMemo, useState } from 'react';

/**
 * The player's controls.
 *
 * Every button carries its full range of states — idle, hover, pressed,
 * keyboard focus, disabled, sending and confirmed — because a poker action is
 * irreversible and a player has to be able to tell what has actually been sent.
 *
 * Sizing a bet is immediate and reversible: nothing leaves the browser until
 * the player confirms.
 */
const LABELS = { fold:'Fold', check:'Check', call:'Call', bet:'Bet', raise:'Raise', allin:'All in' };

export default function ActionBar({ legal = [], onAct, pending, disabled, myStack = 0,
                                    pot = 0, bigBlind = 0, compact, labels = {} }){
  const text = { ...LABELS, ...labels };
  const sizer = useMemo(() => legal.find(a => a.type === 'bet' || a.type === 'raise'), [legal]);
  const [amount, setAmount] = useState(sizer?.min || 0);
  const inFlight = pending?.inFlight;
  const last = pending?.last;

  // Re-anchor the slider whenever the legal range changes underneath it.
  useEffect(() => { setAmount(sizer?.min || 0); }, [sizer?.min, sizer?.max, sizer?.type]);

  if(!legal.length){
    return (
      <div className="pactions is-waiting" aria-live="polite">
        <span className="pactions-idle">{labels.waiting || 'Waiting for the next hand'}</span>
      </div>
    );
  }

  const fire = (type, value = 0) => {
    if(disabled || inFlight) return;
    onAct(type, value);
  };

  const quick = sizer ? [
    { label:'Min', value: sizer.min },
    { label:'½ pot', value: clamp(Math.round(pot / 2), sizer) },
    { label:'Pot', value: clamp(pot, sizer) },
    { label:'Max', value: sizer.max }
  ].filter((option, i, list) => list.findIndex(o => o.value === option.value) === i) : [];

  return (
    <div className={`pactions ${compact ? 'is-compact' : ''}`}>
      {sizer && (
        <div className="pactions-sizer">
          <div className="pactions-quick" role="group" aria-label="Bet size presets">
            {quick.map(option => (
              <button key={option.label} type="button" className={`pchip-btn ${amount === option.value ? 'is-on' : ''}`}
                      onClick={() => setAmount(option.value)} disabled={disabled || Boolean(inFlight)}>
                {option.label}
              </button>
            ))}
          </div>
          <label className="pactions-slider">
            <span className="sr-only">Bet amount</span>
            <input type="range" min={sizer.min} max={sizer.max} step={Math.max(1, bigBlind || 1)}
                   value={amount} disabled={disabled || Boolean(inFlight)}
                   onChange={e => setAmount(Number(e.target.value))} />
            <output aria-live="off">{amount.toLocaleString()}</output>
          </label>
        </div>
      )}

      <div className="pactions-row">
        {legal.map(action => {
          const isSizing = action.type === 'bet' || action.type === 'raise';
          const value = isSizing ? amount : (action.amount || action.min || 0);
          const sending = inFlight?.type === action.type;
          const confirmed = !inFlight && last?.type === action.type && last?.outcome === 'accepted';
          const rejected = !inFlight && last?.type === action.type && last?.outcome === 'rejected';
          return (
            <button key={action.type} type="button"
                    className={['pbtn', `pbtn-${action.type}`,
                                sending ? 'is-sending' : '', confirmed ? 'is-confirmed' : '',
                                rejected ? 'is-rejected' : ''].filter(Boolean).join(' ')}
                    onClick={() => fire(action.type, value)}
                    disabled={disabled || Boolean(inFlight)}
                    aria-busy={sending || undefined}>
              <span className="pbtn-label">
                {text[action.type] || action.type}
                {action.type === 'call' && action.amount ? ` ${action.amount.toLocaleString()}` : ''}
                {isSizing && value ? ` ${value.toLocaleString()}` : ''}
              </span>
              <span className="pbtn-state" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {/* The outcome of the last action is announced, not only coloured. */}
      <p className="pactions-feedback" aria-live="polite">
        {inFlight ? (labels.sending || 'Sending…')
          : last?.outcome === 'accepted' ? (labels.accepted || 'Action accepted')
          : last?.outcome === 'rejected' ? (labels.rejected || 'Action rejected')
          : ''}
      </p>
    </div>
  );
}

const clamp = (value, range) => Math.max(range.min, Math.min(range.max, value));
