import {Resend} from 'resend';

const COPY={
  en:{verify:['Verify your Project ISKRA account','One last step. Verify your email to connect your tickets and unlock member offers.','Verify email'],reset:['Reset your Project ISKRA password','Use this secure link to choose a new password. If you did not request it, ignore this email.','Reset password'],welcome:['Welcome to Project ISKRA','Your account is ready. Your nights, tickets and offers now live in one place.','Open my account']},
  uk:{verify:['Підтвердьте акаунт Project ISKRA','Останній крок. Підтвердьте email, щоб підʼєднати квитки та відкрити пропозиції для учасників.','Підтвердити email'],reset:['Скидання пароля Project ISKRA','Скористайтеся захищеним посиланням, щоб створити новий пароль. Якщо це були не ви, проігноруйте лист.','Скинути пароль'],welcome:['Вітаємо у Project ISKRA','Ваш акаунт готовий. Події, квитки та пропозиції тепер в одному місці.','Відкрити акаунт']},
  ru:{verify:['Подтвердите аккаунт Project ISKRA','Последний шаг. Подтвердите email, чтобы подключить билеты и открыть предложения для участников.','Подтвердить email'],reset:['Сброс пароля Project ISKRA','Используйте защищенную ссылку, чтобы создать новый пароль. Если это были не вы, проигнорируйте письмо.','Сбросить пароль'],welcome:['Добро пожаловать в Project ISKRA','Ваш аккаунт готов. События, билеты и предложения теперь в одном месте.','Открыть аккаунт']}
};
const escape=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

export async function sendAccountEmail({to,name,locale='en',kind,url,idempotencyKey}){
  if(!process.env.RESEND_API_KEY)return {sent:false,status:'skipped'};
  const copy=(COPY[locale]||COPY.en)[kind]||COPY.en.welcome;
  const html=`<!doctype html><html><body style="margin:0;background:#09090b;color:#f7f3f5;font-family:Arial,sans-serif"><div style="max-width:600px;margin:auto;padding:48px 22px"><p style="color:#ff5c1a;font:bold 13px monospace;letter-spacing:4px">PROJECT ISKRA</p><h1 style="font-size:38px;line-height:1;text-transform:uppercase;margin:28px 0 14px">${escape(copy[0])}</h1><p style="color:#b0a8b2;line-height:1.7">${escape(name?`${name}, ${copy[1].charAt(0).toLowerCase()+copy[1].slice(1)}`:copy[1])}</p><a href="${escape(url)}" style="display:inline-block;margin-top:25px;padding:16px 22px;background:#ff5c1a;color:#09090b;text-decoration:none;font:bold 12px monospace;letter-spacing:1px;text-transform:uppercase">${escape(copy[2])}</a><p style="margin-top:30px;color:#6f6872;font-size:11px;line-height:1.6">This secure link expires automatically. Project ISKRA will never ask for your password by email.</p></div></body></html>`;
  const resend=new Resend(process.env.RESEND_API_KEY);
  const {data,error}=await resend.emails.send({from:process.env.RESEND_FROM||'Project ISKRA <noreply@projekt-iskra.com>',to:[to],subject:copy[0],html},{idempotencyKey});
  if(error)throw new Error(error.message||'Email delivery failed.');
  return {sent:true,status:'sent',id:data?.id||null};
}
