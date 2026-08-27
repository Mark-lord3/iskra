import { useId, useRef, useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';

const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

/**
 * The real subscription form. It works with animation, images and JavaScript
 * effects all disabled: state is text, never colour alone, and every change is
 * announced through a single aria-live region.
 */
export default function SignalForm({ compact = false, source = 'newsletter' }) {
  const { t } = useI18n();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle');   // idle | sending | ok | duplicate | error
  const [message, setMessage] = useState('');
  const busy = useRef(false);

  const submit = async e => {
    e.preventDefault();
    if (busy.current) return;                   // no repeated submissions
    const value = email.trim();
    if (!EMAIL.test(value)) {
      setState('error'); setMessage(t('nl.errEmail'));
      return;
    }
    busy.current = true;
    setState('sending'); setMessage('');
    try {
      const res = await api.subscribe(value, location.pathname);
      // The address is only cleared once the relay has it.
      if (res.duplicate) { setState('duplicate'); setMessage(t('nl.dupCopy').replace('{email}', value)); }
      else { setState('ok'); setMessage(t('nl.okCopy').replace('{email}', value)); }
      setEmail('');
    } catch (err) {
      setState('error');
      if (err.status === 429) setMessage(t('nl.errRate'));
      else if (err.code === 'EMAIL') setMessage(t('nl.errEmail'));
      else if (err.code === 'NETWORK_ERROR' || err.code === 'TIMEOUT' || !navigator.onLine)
        setMessage(t('nl.errOffline'));
      else setMessage(t('nl.errServer'));       // email is deliberately kept
    } finally { busy.current = false; }
  };

  const done = state === 'ok' || state === 'duplicate';

  if (done) {
    return (
      <div className={'sig-done' + (compact ? ' compact' : '')} data-state={state}>
        <p className="sig-done-mark" aria-hidden="true">{state === 'ok' ? '◉' : '◎'}</p>
        <h3>{t(state === 'ok' ? 'nl.okTitle' : 'nl.dupTitle')}</h3>
        <p className="sig-done-copy">{message}</p>
        <p className="sr-only" role="status" aria-live="polite">
          {t(state === 'ok' ? 'nl.okTitle' : 'nl.dupTitle')} {message}
        </p>
        <button type="button" className="btn btn-ghost btn-sm"
                onClick={() => { setState('idle'); setMessage(''); }}>
          {t('nl.okAgain')}
        </button>
      </div>
    );
  }

  return (
    <form className={'sig-form' + (compact ? ' compact' : '')} onSubmit={submit} noValidate
          data-state={state}>
      <label className="sig-label" htmlFor={id}>{t('nl.emailLabel')}</label>
      <div className="sig-row">
        <div className="sig-input-wrap">
          <input id={id} name="email" type="email" inputMode="email" autoComplete="email"
                 className="sig-input" placeholder={t('nl.placeholder')}
                 value={email} onChange={e => { setEmail(e.target.value); if (state === 'error') setState('idle'); }}
                 aria-invalid={state === 'error'}
                 aria-describedby={`${id}-status`} required />
          {/* Scanning bar shown only while the request is in flight. */}
          <span className="sig-scan" aria-hidden="true" />
        </div>
        <button className="btn btn-primary sig-send" type="submit"
                disabled={state === 'sending'} aria-busy={state === 'sending'}>
          <span>{state === 'sending' ? t('nl.sending') : t('nl.subscribe')}</span>
        </button>
      </div>
      <p id={`${id}-status`} className={'sig-status' + (state === 'error' ? ' is-error' : '')}
         role="status" aria-live="polite">
        {state === 'error'
          ? <><span aria-hidden="true" className="sig-status-mark">!</span> {message}</>
          : state === 'sending' ? t('nl.sending') : t('nl.statusIdle')}
      </p>
    </form>
  );
}
