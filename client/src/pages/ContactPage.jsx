import { useRef, useState } from 'react';
import { api } from '../api.js';
import Footer from '../components/Footer.jsx';
import Nav from '../components/Nav.jsx';
import PromoBar from '../components/PromoBar.jsx';
import { useI18n } from '../i18n.jsx';
import { SITE } from '../site.js';

/* Each category preselects the subject the admin inbox will be filed under. */
const CATEGORIES = [
  ['general',  'ct.cat.general',  'ct.sub.general'],
  ['birthday', 'ct.cat.birthday', 'ct.sub.birthday'],
  ['table',    'ct.cat.table',    'ct.sub.table'],
  ['booking',  'ct.cat.booking',  'ct.sub.booking'],
  ['venue',    'ct.cat.venue',    'ct.sub.venue'],
  ['brand',    'ct.cat.brand',    'ct.sub.brand'],
  ['press',    'ct.cat.press',    'ct.sub.press']
];

const FAQ = [
  ['ct.faqTables','ct.faqTablesA'], ['ct.faqBirthday','ct.faqBirthdayA'],
  ['ct.faqDress','ct.faqDressA'],   ['ct.faqAge','ct.faqAgeA'],
  ['ct.faqRefund','ct.faqRefundA'], ['ct.faqAccess','ct.faqAccessA'],
  ['ct.faqPartner','ct.faqPartnerA']
];

const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
const ERROR_KEY = { NAME:'ct.errName', EMAIL:'ct.errEmail', MESSAGE:'ct.errMessage',
                    DATE:'ct.errDate', GROUP:'ct.errGroup' };

export default function ContactPage({ onTickets }) {
  const { t } = useI18n();
  const blank = { name:'', email:'', subject:'', message:'', eventDate:'', groupSize:'' };
  const [category, setCategory] = useState('general');
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [state, setState] = useState('idle');   // idle | sending | sent
  const sending = useRef(false);
  const [sentTo, setSentTo] = useState('');

  const update = e => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setErrors(x => ({ ...x, [e.target.name]: null }));
  };

  const pick = (key, subjectKey) => {
    setCategory(key);
    // Selecting a category fills the subject unless the visitor wrote their own.
    const auto = CATEGORIES.some(([, , sk]) => form.subject === t(sk));
    if (!form.subject || auto) setForm(f => ({ ...f, subject: t(subjectKey) }));
  };

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = t('ct.errName');
    if (!EMAIL.test(form.email.trim())) next.email = t('ct.errEmail');
    if (form.message.trim().length < 8) next.message = t('ct.errMessage');
    if (form.groupSize && !(Number(form.groupSize) >= 1 && Number(form.groupSize) <= 500))
      next.groupSize = t('ct.errGroup');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async e => {
    e.preventDefault();
    if (sending.current) return;          // guards against a double submit
    setFormError('');
    if (!validate()) return;

    sending.current = true;
    setState('sending');
    try {
      await api.contact({
        ...form,
        subject: form.subject || t(CATEGORIES.find(c => c[0] === category)[2]),
        category,
        path: location.pathname
      });
      setSentTo(form.email.trim());
      setForm(blank);                     // only cleared once it is safely stored
      setState('sent');
    } catch (err) {
      // The message body is deliberately kept so nothing is lost on a failure.
      if (err.field && ERROR_KEY[err.code]) setErrors(x => ({ ...x, [err.field]: t(ERROR_KEY[err.code]) }));
      else if (err.status === 429) setFormError(t('ct.errRate'));
      else if (err.code === 'NETWORK_ERROR' || err.code === 'TIMEOUT' || !navigator.onLine)
        setFormError(t('ct.errNetwork'));
      else setFormError(t('ct.errServer'));
      setState('idle');
    } finally { sending.current = false; }
  };

  const socials = Object.entries(SITE.social).filter(([, url]) => url);

  return (
    <>
      <PromoBar />
      <Nav onTickets={onTickets} />
      <main className="contact-page">

        {/* ---------- asymmetric editorial opening ---------- */}
        <section className="ct-open">
          <div className="wrap ct-open-grid">
            <div className="ct-open-copy rv">
              <p className="ct-kicker mono">{t('ct.kicker')}</p>
              <h1 className="ct-title">{t('ct.title')}</h1>
              <p className="lead">{t('ct.lead')}</p>
              <p className="ct-reply">
                <span className="ct-reply-dot" aria-hidden="true" />
                <strong>{t('ct.reply')}</strong>
                <span>{t('ct.replyCopy')}</span>
              </p>
            </div>
            <figure className="ct-open-photo rv">
              <img src="/nightlife/contact-door.jpg" alt={t('ct.altDoor')} width="1400" height="933" />
            </figure>
          </div>
        </section>

        {/* ---------- categories + form ---------- */}
        <section className="section ct-main">
          <div className="wrap ct-main-grid">
            <div className="ct-form-col">
              <h2 className="ct-h2">{t('ct.pick')}</h2>
              <div className="ct-cats" role="group" aria-label={t('ct.pick')}>
                {CATEGORIES.map(([key, labelKey, subjectKey]) => (
                  <button key={key} type="button"
                          className={'ct-cat' + (category === key ? ' on' : '')}
                          aria-pressed={category === key}
                          onClick={() => pick(key, subjectKey)}>
                    {t(labelKey)}
                  </button>
                ))}
              </div>

              {state === 'sent' ? (
                <div className="ct-sent rv" role="status">
                  <p className="ct-sent-mark" aria-hidden="true">✦</p>
                  <h3>{t('ct.sentTitle')}</h3>
                  <p>{t('ct.sentCopy').replace('{email}', sentTo)}</p>
                  <p className="ct-sent-reply mono">{t('ct.reply')}</p>
                  <button className="btn btn-ghost" onClick={() => setState('idle')}>
                    {t('ct.sentAnother')}
                  </button>
                </div>
              ) : (
                <form className="ct-form" onSubmit={submit} noValidate>
                  <div className="ct-row">
                    <label className="ct-field">
                      <span>{t('contact.name')}</span>
                      <input name="name" value={form.name} onChange={update} required
                             autoComplete="name"
                             aria-invalid={!!errors.name} aria-describedby={errors.name ? 'e-name' : undefined} />
                      {errors.name && <em id="e-name" className="ct-err">{errors.name}</em>}
                    </label>
                    <label className="ct-field">
                      <span>{t('contact.email')}</span>
                      <input name="email" type="email" value={form.email} onChange={update} required
                             autoComplete="email" inputMode="email"
                             aria-invalid={!!errors.email} aria-describedby={errors.email ? 'e-email' : undefined} />
                      {errors.email && <em id="e-email" className="ct-err">{errors.email}</em>}
                    </label>
                  </div>

                  <label className="ct-field">
                    <span>{t('contact.subject')}</span>
                    <input name="subject" value={form.subject} onChange={update}
                           placeholder={t(CATEGORIES.find(c => c[0] === category)[2])} />
                  </label>

                  <div className="ct-row">
                    <label className="ct-field">
                      <span>{t('ct.date')} <i>{t('ct.optional')}</i></span>
                      <input name="eventDate" type="date" value={form.eventDate} onChange={update}
                             aria-invalid={!!errors.eventDate}
                             aria-describedby={errors.eventDate ? 'e-date' : undefined} />
                      {errors.eventDate && <em id="e-date" className="ct-err">{errors.eventDate}</em>}
                    </label>
                    <label className="ct-field">
                      <span>{t('ct.group')} <i>{t('ct.optional')}</i></span>
                      <input name="groupSize" type="number" min="1" max="500" inputMode="numeric"
                             value={form.groupSize} onChange={update} placeholder={t('ct.groupHint')}
                             aria-invalid={!!errors.groupSize}
                             aria-describedby={errors.groupSize ? 'e-group' : undefined} />
                      {errors.groupSize && <em id="e-group" className="ct-err">{errors.groupSize}</em>}
                    </label>
                  </div>

                  <label className="ct-field">
                    <span>{t('contact.message')}</span>
                    <textarea name="message" rows="6" value={form.message} onChange={update} required
                              aria-invalid={!!errors.message}
                              aria-describedby={errors.message ? 'e-msg' : undefined} />
                    {errors.message && <em id="e-msg" className="ct-err">{errors.message}</em>}
                  </label>

                  {formError && <p className="ct-formerr" role="alert">{formError}</p>}

                  <button className="btn btn-primary ct-submit" type="submit"
                          disabled={state === 'sending'} aria-busy={state === 'sending'}>
                    {state === 'sending' ? t('ct.sending') : t('ct.send')}
                  </button>
                </form>
              )}
            </div>

            <aside className="ct-side">
              <figure className="ct-side-photo rv">
                <img src="/nightlife/contact-bar.jpg" alt={t('ct.altBar')} width="900" height="600" loading="lazy" />
              </figure>
              <div className="ct-direct">
                <h3 className="mono">{t('ct.direct')}</h3>
                <a href={`mailto:${SITE.email}`} className="ct-mail">{SITE.email}</a>
                <p className="ct-addr">{SITE.address}<br />{SITE.hours}</p>
              </div>
              {socials.length > 0 && (
                <div className="ct-direct">
                  <h3 className="mono">{t('ct.follow')}</h3>
                  <ul className="ct-social">
                    {socials.map(([name, url]) => (
                      <li key={name}>
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          {name[0].toUpperCase() + name.slice(1)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="section ct-faq-sec">
          <div className="wrap ct-faq-grid">
            <div className="ct-faq-head rv">
              <h2 className="ct-h2">{t('ct.faq')}</h2>
              <figure className="ct-faq-photo">
                <img src="/nightlife/contact-table.jpg" alt={t('ct.altTable')} width="900" height="600" loading="lazy" />
              </figure>
            </div>
            <dl className="ct-faq rv">
              {FAQ.map(([q, a]) => (
                <div className="ct-faq-item" key={q}>
                  <dt>{t(q)}</dt>
                  <dd>{t(a)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
