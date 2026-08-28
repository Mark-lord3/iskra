import QRCode from 'qrcode';
import { Resend } from 'resend';
import Order from '../models/Order.js';
import Ticket from '../models/Ticket.js';
import {syncLegacyVipTables} from './vipTables.js';

const COPY={
  en:{subject:title=>`Your tickets for ${title}`,hello:name=>`Hi ${name},`,intro:'Your ISKRA tickets are confirmed. Show any QR code below at the door.',date:'Date',room:'Venue',ticket:'Ticket',footer:'Keep this email. Each QR code admits one guest.'},
  uk:{subject:title=>`Ваші квитки на ${title}`,hello:name=>`Вітаємо, ${name}!`,intro:'Ваші квитки ISKRA підтверджено. Покажіть QR-код нижче на вході.',date:'Дата',room:'Локація',ticket:'Квиток',footer:'Збережіть цей лист. Кожен QR-код дійсний для одного гостя.'},
  ru:{subject:title=>`Ваши билеты на ${title}`,hello:name=>`Здравствуйте, ${name}!`,intro:'Ваши билеты ISKRA подтверждены. Покажите QR-код ниже на входе.',date:'Дата',room:'Площадка',ticket:'Билет',footer:'Сохраните это письмо. Каждый QR-код действителен для одного гостя.'}
};
const LOCALES={en:'en-CA',uk:'uk-UA',ru:'ru-RU'};
const escapeHtml=value=>String(value ?? '').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function deliverTicketEmail(orderId,{force=false,recipient=null,trigger='automatic'}={}){
  if(!process.env.RESEND_API_KEY){
    if(!force)await Order.updateOne({_id:orderId,emailStatus:{$ne:'sent'}},{$set:{emailStatus:'skipped',emailError:'RESEND_API_KEY is not configured.'}});
    return {sent:false,status:'skipped'};
  }

  const staleBefore=new Date(Date.now()-5*60_000);
  const attemptedAt=new Date();
  const deliveryState=force
    ? {$or:[{emailStatus:{$ne:'sending'}},{emailStatus:'sending',emailAttemptedAt:{$lt:staleBefore}}]}
    : {$or:[
        {emailStatus:{$exists:false}},
        {emailStatus:{$in:['pending','failed','skipped']}},
        {emailStatus:'sending',emailAttemptedAt:{$lt:staleBefore}}
      ]};
  let order=await Order.findOneAndUpdate(
    {_id:orderId,status:'paid',...deliveryState},
    {$set:{emailStatus:'sending',emailAttemptedAt:attemptedAt,emailError:null},$inc:{emailAttemptCount:1}},
    {new:false}
  );
  if(!order) return {sent:false,status:'already_handled'};

  try{
    if(order.tierKey==='booth'){
      await syncLegacyVipTables(order.eventSlug);
      order=await Order.findById(order._id);
    }
    const destination=String(recipient || order.email || '').trim().toLowerCase();
    if(!EMAIL.test(destination))throw new Error('The order does not have a valid delivery email.');
    const tickets=await Ticket.find({orderId:order._id}).select('+qrPayload').sort({createdAt:1});
    if(!tickets.length) throw new Error('No tickets were found for this order.');
    const language=COPY[order.locale] ? order.locale : 'en';
    const copy=COPY[language];
    const date=new Intl.DateTimeFormat(LOCALES[language],{
      timeZone:'UTC',weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'
    }).format(tickets[0].eventDate);
    const attachments=[];
    const cards=[];
    for(const [index,ticket] of tickets.entries()){
      const contentId=`iskra-ticket-${index+1}`;
      const png=await QRCode.toBuffer(ticket.qrPayload,{width:560,margin:2,errorCorrectionLevel:'M'});
      attachments.push({filename:`${ticket.reference}.png`,content:png,contentType:'image/png',contentId});
      cards.push(`<div style="margin:22px 0;padding:22px;border:1px solid #302a35;background:#120c18;text-align:center">
        <p style="margin:0 0 12px;color:#ff5c1a;font:700 12px monospace;letter-spacing:2px;text-transform:uppercase">${escapeHtml(copy.ticket)} ${index+1}</p>
        <img src="cid:${contentId}" width="240" height="240" alt="QR ${escapeHtml(ticket.reference)}" style="display:block;width:240px;height:240px;margin:0 auto 14px;padding:8px;background:#fff">
        <strong style="font:700 13px monospace;letter-spacing:1px;color:#f6f2f8">${escapeHtml(ticket.reference)}</strong>
      </div>`);
    }
    const eventTitle=escapeHtml(tickets[0].eventTitle);
    const legacyVip=order.tierKey==='booth'&&!order.admissionQty;
    const customVipOnly=Boolean(order.customOrderId)&&!order.customOrderSnapshot?.admission?.qty;
    const intro=legacyVip
      ? 'Your VIP table is confirmed, but entry is not included. The reservation QR does not admit a guest; buy 1–4 admission tickets with the private code below.'
      : customVipOnly ? 'Your private VIP package is confirmed. Its reservation QR does not admit a guest; every guest needs a separate admission ticket.'
      : copy.intro;
    const vipCode=legacyVip&&order.vipAdmissionCode
      ? `<div style="margin:22px 0;padding:18px;border:1px solid #ff5c1a;background:#1b0d0b;text-align:center"><p style="margin:0 0 8px;color:#a99fb6;font:11px monospace;letter-spacing:2px;text-transform:uppercase">Private admission code · ${escapeHtml(order.vipDiscountPercent)}% off</p><strong style="font:700 22px monospace;letter-spacing:2px;color:#f6f2f8">${escapeHtml(order.vipAdmissionCode)}</strong><p style="margin:8px 0 0;color:#a99fb6;font-size:12px">Valid once for up to four admission tickets for this event.</p></div>`
      : '';
    const customPackage=order.customOrderSnapshot
      ? `<div style="margin:22px 0;padding:18px;border:1px solid #302a35;background:#120c18"><p style="margin:0 0 10px;color:#ff5c1a;font:700 12px monospace;letter-spacing:2px;text-transform:uppercase">${escapeHtml(order.customOrderSnapshot.title||'Private package')}</p>${order.customOrderSnapshot.description?`<p style="margin:0 0 10px;color:#a99fb6;line-height:1.5">${escapeHtml(order.customOrderSnapshot.description)}</p>`:''}${order.customOrderSnapshot.vip?.inclusions?.length?`<p style="margin:0;color:#f6f2f8;line-height:1.7">${order.customOrderSnapshot.vip.inclusions.map(escapeHtml).join(' · ')}</p>`:''}</div>`
      : '';
    const html=`<!doctype html><html><body style="margin:0;background:#07050a;color:#f6f2f8;font-family:Arial,sans-serif">
      <div style="max-width:620px;margin:0 auto;padding:42px 20px">
        <p style="margin:0;color:#ff5c1a;font:bold 14px monospace;letter-spacing:4px">PROJECT ISKRA</p>
        <h1 style="margin:24px 0 12px;font-size:36px;line-height:1;text-transform:uppercase">${eventTitle}</h1>
        <p style="color:#f6f2f8">${escapeHtml(copy.hello(order.buyerName))}</p>
        <p style="color:#a99fb6;line-height:1.6">${escapeHtml(intro)}</p>
        ${vipCode}
        ${customPackage}
        <div style="margin:24px 0;padding:16px 0;border-top:1px solid #302a35;border-bottom:1px solid #302a35;color:#a99fb6;line-height:1.8">
          <b style="color:#f6f2f8">${escapeHtml(copy.date)}:</b> ${escapeHtml(date)}<br>
          <b style="color:#f6f2f8">${escapeHtml(copy.room)}:</b> ${escapeHtml(tickets[0].room)}
        </div>
        ${cards.join('')}
        <p style="margin-top:28px;color:#6f6580;font-size:12px;line-height:1.6">${escapeHtml(legacyVip||customVipOnly?'VIP table reservation only. A separate admission QR is required for every guest.':copy.footer)}</p>
      </div></body></html>`;
    const resend=new Resend(process.env.RESEND_API_KEY);
    const {data,error}=await resend.emails.send({
      from:process.env.RESEND_FROM || 'Project ISKRA <noreply@projekt-iskra.com>',
      to:[destination],subject:copy.subject(tickets[0].eventTitle),html,attachments
    },{idempotencyKey:force
      ? `ticket-order/${order._id}/manual/${attemptedAt.getTime()}`
      : `ticket-order/${order._id}`});
    if(error) throw new Error(error.message || 'Resend rejected the email.');
    const sentAt=new Date();
    const update={$set:{emailStatus:'sent',emailId:data?.id || null,emailSentAt:sentAt,emailError:null}};
    if(force){
      update.$set.emailLastResentAt=sentAt;
      update.$set.emailLastResendError=null;
      update.$set.emailLastTrigger=String(trigger).slice(0,80);
      update.$inc={emailResendCount:1};
    }
    await Order.updateOne({_id:order._id},update);
    return {sent:true,status:'sent',id:data?.id || null,recipient:destination};
  }catch(error){
    const message=String(error.message || error).slice(0,500);
    await Order.updateOne({_id:order._id},{$set:{
      emailStatus:force && order.emailStatus==='sent' ? 'sent' : 'failed',
      emailError:message,
      ...(force?{emailLastResendError:message}:{})
    }});
    console.error(`Ticket email failed for order ${order._id}:`,error.message);
    return {sent:false,status:'failed',error:message};
  }
}

export async function retryFailedTicketEmails(){
  if(!process.env.RESEND_API_KEY) return;
  const staleBefore=new Date(Date.now()-5*60_000);
  const orders=await Order.find({status:'paid',$or:[
    {emailStatus:{$exists:false}},
    {emailStatus:{$in:['failed','skipped']}},
    {emailStatus:'sending',emailAttemptedAt:{$lt:staleBefore}}
  ]}).select('_id').sort({createdAt:1}).limit(10).lean();
  for(const order of orders) await deliverTicketEmail(order._id);
}
