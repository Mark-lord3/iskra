import {Resend} from 'resend';
import {PRIZES} from '../lib/prizes.js';

const escape=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

export async function sendArcadeResultEmail({entry,contest}){
  if(!process.env.RESEND_API_KEY)return {status:'skipped'};
  const prize=PRIZES[entry.rewardTier]||PRIZES.played;
  const origin=String(process.env.CLIENT_ORIGIN||'https://iskra.orvadora.com').split(',')[0].trim();
  const checkout=`${origin}/schedule?event=${encodeURIComponent(contest.eventSlug)}&promo=${encodeURIComponent(entry.rewardCode)}`;
  const subject=`Your Project ISKRA result: rank #${entry.finalizedRank}`;
  const html=`<!doctype html><html><body style="margin:0;background:#09090b;color:#f7f3f5;font-family:Arial,sans-serif"><div style="max-width:600px;margin:auto;padding:48px 22px"><p style="color:#ff5c1a;font:bold 13px monospace;letter-spacing:4px">PROJECT ISKRA · ENTER THE SPARK</p><h1 style="font-size:42px;line-height:1;text-transform:uppercase;margin:28px 0 14px">Rank #${entry.finalizedRank}</h1><p style="color:#b0a8b2;line-height:1.7">${escape(entry.handle)}, the board for <b style="color:#fff">${escape(contest.eventTitle)}</b> is final. You earned <b style="color:#ff5c1a">${escape(prize.head)}</b>.</p><div style="margin:28px 0;padding:20px;border:1px solid #ff5c1a;font:bold 20px monospace;letter-spacing:2px">${escape(entry.rewardCode)}</div><a href="${escape(checkout)}" style="display:inline-block;padding:16px 22px;background:#ff5c1a;color:#09090b;text-decoration:none;font:bold 12px monospace;letter-spacing:1px;text-transform:uppercase">Use my reward</a><p style="margin-top:30px;color:#6f6872;font-size:11px;line-height:1.6">This private code applies to one ticket for this event, cannot be combined with another offer, and expires when the event begins.</p></div></body></html>`;
  const resend=new Resend(process.env.RESEND_API_KEY);
  const {data,error}=await resend.emails.send({from:process.env.RESEND_FROM||'Project ISKRA <noreply@projekt-iskra.com>',to:[entry.email],subject,html},{idempotencyKey:`arcade/${contest._id}/${entry._id}`});
  if(error)throw new Error(error.message||'Email delivery failed.');
  return {status:'sent',id:data?.id||null};
}
