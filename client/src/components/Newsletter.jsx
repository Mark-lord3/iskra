import { useState } from 'react';
import Photo from './Photo.jsx';
import { api } from '../api.js';
import { useToast } from './Toasts.jsx';
import {useI18n} from '../i18n.jsx';

export default function Newsletter() {
  const {t}=useI18n();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.subscribe(email);
      setEmail('');
      toast(t('newsletter.success'), '✦');
    } catch (err) { toast(err.message, '!'); }
    finally { setBusy(false); }
  };

  return (
    <section className="section" id="newsletter" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="nl rv">
          <Photo plate="terrace" alt="" />
          <h3>{t('newsletter.heading').split('\n').map((line,index)=><span key={line}>{line}{index===0&&<br />}</span>)}</h3>
          <p>{t('newsletter.copy')}</p>
          <form className="nl-form" onSubmit={submit}>
            <input type="email" required placeholder="you@email.com" aria-label={t('newsletter.email')}
                   value={email} onChange={e => setEmail(e.target.value)} />
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? t('newsletter.adding') : t('newsletter.subscribe')}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
