import { useEffect, useMemo, useState } from 'react';
import { api, savedPlayer } from '../api.js';
import { useToast } from './Toasts.jsx';
import { fmtDate, money, tiersFor } from '../utils.js';

export default function TicketModal({ event, presetCode, onClose }) {
  const toast = useToast();
  const [tierIdx, setTierIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [input, setInput] = useState(presetCode || '');
  const [code, setCode] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const tiers = useMemo(() => tiersFor(event), [event]);
  const tier = tiers[tierIdx];

  const validate = async (value, silent) => {
    const v = (value ?? input).trim().toUpperCase();
    if (!v) { setCode(null); setMsg(''); return; }
    try {
      const r = await api.validateCode(v);
      if (r.valid) {
        setCode(r); setMsg('✓ ' + r.label);
        if (!silent) toast(`Promo <b>${v}</b> applied`, '✦');
      } else { setCode(null); setMsg('Not valid. ' + (r.error || 'That code is not valid')); }
    } catch (e) { setCode(null); setMsg(e.message); }
  };

  // A code won in Spark Rush is applied for the player automatically.
  useEffect(() => { if (presetCode) validate(presetCode, true); }, [presetCode]); // eslint-disable-line

  const { total, saved, notes } = useMemo(() => {
    const subtotal = tier.p * qty;
    let total = subtotal;
    const notes = [];
    if (qty >= 4) {
      const free = Math.floor(qty / 4) * tier.p;
      total -= free; notes.push(`Group deal: ${Math.floor(qty / 4)} free`);
    }
    if (code) {
      const n = Math.min(qty, code.maxQty || qty);
      const share = (total / qty) * n;
      const next = code.flat ? total - share + code.flat * n : total - share * code.off;
      if (next < total) { total = next; notes.push(code.label); }
    }
    return { total: Math.max(0, total), saved: Math.max(0, subtotal - total), notes };
  }, [tier, qty, code]);

  const checkout = async () => {
    setBusy(true);
    try {
      const p = savedPlayer();
      await api.order({
        eventSlug: event.id, tier: tier.n, qty,
        subtotal: tier.p * qty, total, code: code?.code || null, playerId: p?.id || null
      });
      toast(`Reserved ${qty} for ${event.title.split(':')[0]}`, '✦');
      onClose();
    } catch (e) { toast(e.message, '!'); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const d = new Date(event.date);
  return (
    <div className="modal open" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-in">
        <div className="modal-head">
          <div>
            <h3>{event.title}</h3>
            <p>{fmtDate(event.date, { weekday:'short', day:'numeric', month:'short' }).toUpperCase()}, {event.room.toUpperCase()}</p>
          </div>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>

        {tiers.map((t, i) => (
          <div key={t.n} className={'tier' + (i === tierIdx ? ' on' : '')} onClick={() => setTierIdx(i)}>
            <div><b>{t.n}</b><small>{t.d}</small></div>
            <span className="p">{money(t.p)}</span>
          </div>
        ))}

        <div className="qty">
          <div>
            <b style={{ fontSize: 14 }}>Quantity</b><br />
            <small style={{ color:'var(--dim)', fontSize:12 }}>
              {qty >= 4 ? 'Group deal applied' : 'Four tickets, one free'}
            </small>
          </div>
          <div className="qty-ctl">
            <button onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Decrease">−</button>
            <b>{qty}</b>
            <button onClick={() => setQty(q => Math.min(10, q + 1))} aria-label="Increase">+</button>
          </div>
        </div>

        <div className="promoline">
          <input value={input} placeholder="Promo code" aria-label="Promo code"
                 onChange={e => setInput(e.target.value)}
                 onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); validate(); } }} />
          <button className="btn btn-ghost btn-sm" onClick={() => validate()}>Apply</button>
        </div>
        <div className="err" style={{ marginTop:-8, color: code ? 'var(--acid)' : '#ff6b6b' }}>{msg}</div>

        <div className="total">
          <div>
            <span>Total</span>
            <div className="save">{saved > 0 ? `You save ${money(saved)}: ${notes.join(' + ')}` : ''}</div>
          </div>
          <b>{total <= 0 ? 'FREE' : money(total)}</b>
        </div>

        <button className="btn btn-primary" style={{ width:'100%' }} disabled={busy} onClick={checkout}>
          {busy ? 'Reserving…' : 'Checkout →'}
        </button>
        <p className="mono" style={{ fontSize:10, color:'var(--dim)', marginTop:14, textAlign:'center', letterSpacing:'.1em' }}>
          DEMO CHECKOUT. NO PAYMENT IS TAKEN
        </p>
      </div>
    </div>
  );
}
