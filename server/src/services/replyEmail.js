import {Resend} from 'resend';

const escape = value => String(value ?? '').replace(/[&<>'"]/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

/**
 * A reply from the team to someone who wrote in.
 *
 * The original enquiry is quoted underneath so the recipient has context, and
 * a reply-to is set so their answer reaches a mailbox a person reads rather
 * than the no-reply sender.
 */
export async function sendContactReply({to, name, subject, body, original, replyTo}){
  if(!process.env.RESEND_API_KEY) return {sent:false, status:'skipped'};

  const paragraphs = String(body).trim().split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 16px;line-height:1.7;color:#1d1a20">${escape(p).replace(/\n/g,'<br>')}</p>`)
    .join('');

  const quoted = original
    ? `<div style="margin-top:32px;padding-top:18px;border-top:1px solid #e6dfe3">
         <p style="margin:0 0 8px;font:600 11px monospace;letter-spacing:.14em;color:#8b8189;text-transform:uppercase">Your original message</p>
         <p style="margin:0;color:#8b8189;font-size:13px;line-height:1.6;white-space:pre-wrap">${escape(original)}</p>
       </div>`
    : '';

  const html = `<!doctype html><html><body style="margin:0;background:#fbf7f8;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
    <div style="max-width:600px;margin:auto;padding:40px 22px">
      <p style="color:#ff5c1a;font:bold 12px monospace;letter-spacing:4px;margin:0 0 26px">PROJECT ISKRA</p>
      ${name ? `<p style="margin:0 0 16px;line-height:1.7;color:#1d1a20">Hi ${escape(name)},</p>` : ''}
      ${paragraphs}
      <p style="margin:26px 0 0;color:#8b8189;font-size:13px">— Project ISKRA<br>Montréal</p>
      ${quoted}
    </div></body></html>`;

  const text = `${name ? `Hi ${name},\n\n` : ''}${String(body).trim()}\n\n— Project ISKRA\nMontréal`
    + (original ? `\n\n---\nYour original message:\n${original}` : '');

  const resend = new Resend(process.env.RESEND_API_KEY);
  const {data, error} = await resend.emails.send({
    from: process.env.RESEND_FROM || 'Project ISKRA <noreply@projekt-iskra.com>',
    to: [to],
    // Answers land somewhere a person reads, not the no-reply sender.
    reply_to: replyTo || process.env.SUPPORT_REPLY_TO || 'doors@iskra.orvadora.com',
    subject,
    html,
    text
  });

  if(error) throw new Error(error.message || 'Email delivery failed.');
  return {sent:true, status:'sent', id:data?.id || null};
}
