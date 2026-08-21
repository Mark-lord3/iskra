import { useState } from 'react';
import Photo from './Photo.jsx';
import { api } from '../api.js';
import { useToast } from './Toasts.jsx';

export default function Newsletter() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.subscribe(email);
      setEmail('');
      toast('You are on the list. Presale codes land in your inbox first.', '✦');
    } catch (err) { toast(err.message, '!'); }
    finally { setBusy(false); }
  };

  return (
    <section className="section" id="newsletter" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="nl rv">
          <Photo plate="terrace" alt="" />
          <h3>Get the drops<br />before the algorithm</h3>
          <p>Lineups, presale codes and the occasional secret address. Two emails a month, no filler.</p>
          <form className="nl-form" onSubmit={submit}>
            <input type="email" required placeholder="you@email.com" aria-label="Email address"
                   value={email} onChange={e => setEmail(e.target.value)} />
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Adding' : 'Subscribe'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
