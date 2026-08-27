import { Router } from 'express';
import AnalyticsEvent from '../models/AnalyticsEvent.js';
import Banner from '../models/Banner.js';
import ContactMessage from '../models/ContactMessage.js';
import Event from '../models/Event.js';
import EventFeedback from '../models/EventFeedback.js';
import GalleryItem from '../models/GalleryItem.js';
import Order from '../models/Order.js';
import PromoCode from '../models/PromoCode.js';
import SiteSetting from '../models/SiteSetting.js';
import Subscriber from '../models/Subscriber.js';
import Ticket from '../models/Ticket.js';
import ScannerSession from '../models/ScannerSession.js';
import ScanLog from '../models/ScanLog.js';
import User from '../models/User.js';
import Membership from '../models/Membership.js';
import Campaign from '../models/Campaign.js';
import CampaignExposure from '../models/CampaignExposure.js';
import ConsentEvent from '../models/ConsentEvent.js';
import {EMAIL_TEMPLATES} from '../services/emailCatalog.js';
import { createInvite } from '../lib/scannerAuth.js';
import QRCode from 'qrcode';
import { requireAdmin } from '../lib/adminAuth.js';

const r = Router();

/* Authorisation lives in lib/adminAuth: a signed, httpOnly session cookie
   issued by POST /api/auth/login. */

const cleanEvent = e => ({
  id:e.slug, slug:e.slug, date:e.date, title:e.title, support:e.support, room:e.room,
  address:e.address,description:e.description,image:e.image,tags:e.tags,badges:e.badges,
  from:e.from,was:e.was,sold:e.sold,capacity:e.capacity,active:e.active,
  arcadeEnabled:e.arcadeEnabled!==false,arcadeMinParticipants:e.arcadeMinParticipants||30
});

const cleanTicket = ticket => ({
  id:ticket._id,reference:ticket.reference,eventSlug:ticket.eventSlug,eventTitle:ticket.eventTitle,
  eventDate:ticket.eventDate,room:ticket.room,buyerName:ticket.buyerName,buyerEmail:ticket.buyerEmail,
  tier:ticket.tier,price:ticket.price,status:ticket.status,redeemedAt:ticket.redeemedAt,
  createdAt:ticket.createdAt
});
const localizedValue=(value,locale='en')=>value?.get?.(locale)||value?.[locale]||value?.get?.('en')||value?.en||'';

r.get('/banners', async (_req,res,next)=>{
  try{
    const banners = await Banner.find({active:true}).sort({updatedAt:-1}).lean();
    res.json(banners.map(b=>({
      id:b._id, title:b.title, text:b.text, cta:b.cta, href:b.href, placement:b.placement
    })));
  }catch(e){ next(e); }
});

r.use(requireAdmin);

r.get('/summary', async (_req,res,next)=>{
  try{
    const activitySince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [subscribers, messages, unreadMessages, orders, paidOrders, visits, clicks, signups, events, banners, recentMessages, tickets, ticketCount, checkedIn, gallery, siteStatus, datingApp, feedback, recentOrders, promoCodes, scanLog, activity, revenueRows] = await Promise.all([
      Subscriber.countDocuments(),
      ContactMessage.countDocuments(),
      ContactMessage.countDocuments({status:'new'}),
      Order.countDocuments(),
      Order.countDocuments({paymentStatus:'paid'}),
      AnalyticsEvent.countDocuments({type:'visit'}),
      AnalyticsEvent.countDocuments({type:'click'}),
      AnalyticsEvent.countDocuments({type:'signup'}),
      Event.find({}).sort({date:-1}).lean(),
      Banner.find({}).sort({updatedAt:-1}).lean(),
      ContactMessage.find({}).sort({createdAt:-1}).limit(25).lean(),
      Ticket.find({}).sort({createdAt:-1}).limit(300).lean(),
      Ticket.countDocuments(),
      Ticket.countDocuments({status:'redeemed'}),
      GalleryItem.find({}).sort({order:1,createdAt:-1}).lean(),
      SiteSetting.findOne({key:'public-status'}).lean(),
      SiteSetting.findOne({key:'dating-app'}).lean(),
      EventFeedback.find({}).sort({createdAt:-1}).limit(200).lean(),
      Order.find({}).sort({createdAt:-1}).limit(80).lean(),
      PromoCode.find({}).sort({updatedAt:-1}).lean(),
      ScanLog.find({}).sort({createdAt:-1}).limit(40).lean(),
      AnalyticsEvent.aggregate([
        {$match:{createdAt:{$gte:activitySince}}},
        {$group:{_id:{day:{$dateToString:{format:'%Y-%m-%d',date:'$createdAt'}},type:'$type'},count:{$sum:1}}},
        {$sort:{'_id.day':1}}
      ]),
      Order.aggregate([
        {$match:{paymentStatus:'paid'}},
        {$group:{_id:null,gross:{$sum:'$total'}}}
      ])
    ]);
    const subscribersList = await Subscriber.find({}).sort({createdAt:-1}).limit(200).lean();
    const [users,userCount,memberships,campaigns,consentCount,campaignStats] = await Promise.all([
      User.find({status:'active'}).select('email name locale emailVerifiedAt preferences createdAt lastLoginAt').sort({createdAt:-1}).limit(200).lean(),
      User.countDocuments({status:'active'}),
      Membership.find({}).sort({updatedAt:-1}).limit(200).lean(),
      Campaign.find({}).sort({priority:-1,createdAt:-1}).lean(),
      ConsentEvent.countDocuments(),
      CampaignExposure.aggregate([{$group:{_id:'$campaignId',impressions:{$sum:'$impressions'},dismissals:{$sum:'$dismissals'},conversions:{$sum:{$cond:[{$ne:['$convertedAt',null]},1,0]}}}}])
    ]);
    const campaignStatsById=new Map(campaignStats.map(row=>[String(row._id),row]));

    res.json({
      totals:{ subscribers,messages,unreadMessages,orders,paidOrders,visits,clicks,signups,
        tickets:ticketCount,checkedIn,revenue:revenueRows[0]?.gross || 0,users:userCount,
        activeMemberships:memberships.filter(row=>['active','trialing'].includes(row.status)).length,consentRecords:consentCount },
      events:events.map(cleanEvent),
      banners,
      messages:recentMessages,
      subscribers:subscribersList,
      users:users.map(user=>({id:user._id,email:user.email,name:user.name,locale:user.locale,emailVerified:Boolean(user.emailVerifiedAt),preferences:user.preferences,createdAt:user.createdAt,lastLoginAt:user.lastLoginAt})),
      memberships:memberships.map(row=>({id:row._id,userId:row.userId,plan:row.plan,status:row.status,currentPeriodEnd:row.currentPeriodEnd,cancelAtPeriodEnd:row.cancelAtPeriodEnd})),
      campaigns:campaigns.map(campaign=>{const stats=campaignStatsById.get(String(campaign._id))||{};return {id:campaign._id,key:campaign.key,title:localizedValue(campaign.title),placement:campaign.placement,audience:campaign.audience,active:campaign.active,frequencyCap:campaign.frequencyCap,priority:campaign.priority,impressions:stats.impressions||0,dismissals:stats.dismissals||0,conversions:stats.conversions||0};}),
      emailTemplates:Object.keys(EMAIL_TEMPLATES).map(key=>({key,group:EMAIL_TEMPLATES[key].group,subject:EMAIL_TEMPLATES[key].en.subject,locales:['en','uk','ru']})),
      tickets:tickets.map(cleanTicket),
      gallery,
      siteStatus:siteStatus?.value || {open:true,message:''},
      datingApp:datingApp?.value || {enabled:false,competitionEnabled:false,message:'The ISKRA social room is currently closed.'},
      feedback,
      orders:recentOrders.map(order=>({
        id:order._id,eventSlug:order.eventSlug,tier:order.tier,qty:order.qty,total:order.total,
        code:order.code,email:order.email,buyerName:order.buyerName,paymentStatus:order.paymentStatus,
        status:order.status,emailStatus:order.emailStatus,createdAt:order.createdAt
      })),
      promoCodes:promoCodes.map(code=>({
        id:code._id,code:code.code,label:code.label,off:code.off,flat:code.flat,minQty:code.minQty,maxQty:code.maxQty,
        active:code.active,startsAt:code.startsAt,expiresAt:code.expiresAt,kind:code.kind,
        appliesTo:code.appliesTo,status:!code.active ? 'inactive'
          : code.startsAt && code.startsAt > new Date() ? 'scheduled'
          : code.expiresAt && code.expiresAt < new Date() ? 'expired' : 'live'
      })),
      scanLog:scanLog.map(log=>({
        id:log._id,at:log.createdAt,label:log.label,reference:log.reference,
        outcome:log.outcome,eventSlug:log.eventSlug
      })),
      activity:activity.map(row=>({day:row._id.day,type:row._id.type,count:row.count})),
      feedbackSummary:{
        count:feedback.length,
        average:feedback.length ? Number((feedback.reduce((sum,item)=>sum+item.rating,0)/feedback.length).toFixed(1)) : 0,
        music:feedback.length ? Number((feedback.reduce((sum,item)=>sum+item.music,0)/feedback.length).toFixed(1)) : 0,
        venue:feedback.length ? Number((feedback.reduce((sum,item)=>sum+item.venue,0)/feedback.length).toFixed(1)) : 0
      }
    });
  }catch(e){ next(e); }
});

r.get('/orders', async (req,res,next)=>{
  try{
    const limit = Math.min(50,Math.max(5,Number(req.query.limit)||10));
    const total = await Order.countDocuments();
    const pages = Math.max(1,Math.ceil(total/limit));
    const page = Math.min(pages,Math.max(1,Number(req.query.page)||1));
    const rows = await Order.find({}).sort({createdAt:-1})
      .skip((page-1)*limit).limit(limit).lean();
    res.json({
      items:rows.map(order=>({
        id:order._id,eventSlug:order.eventSlug,tier:order.tier,qty:order.qty,total:order.total,
        code:order.code,email:order.email,buyerName:order.buyerName,paymentStatus:order.paymentStatus,
        status:order.status,emailStatus:order.emailStatus,createdAt:order.createdAt
      })),
      pagination:{page,pages,limit,total,hasPrevious:page>1,hasNext:page<pages}
    });
  }catch(e){ next(e); }
});

r.post('/events', async (req,res,next)=>{
  try{
    const slug = String(req.body.slug || req.body.title || '')
      .trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    if(!slug || !req.body.date || !req.body.title) {
      return res.status(400).json({error:'Title, slug and date are required.'});
    }
    const event = await Event.findOneAndUpdate(
      {slug},
      {
        slug,
        date:new Date(req.body.date),
        title:String(req.body.title).trim(),
        support:String(req.body.support || '').trim(),
        room:String(req.body.room || 'Main Hall').trim(),
        address:String(req.body.address || '').trim(),
        description:String(req.body.description || '').trim(),
        image:String(req.body.image || '').trim(),
        tags:String(req.body.tags || '').split(',').map(s=>s.trim()).filter(Boolean),
        badges:String(req.body.badges || '').split(',').map(s=>s.trim()).filter(Boolean),
        from:Number(req.body.from) || 0,
        was:Number(req.body.was) || 0,
        sold:Math.min(100, Math.max(0, Number(req.body.sold) || 0)),
        capacity:Math.max(0,Number(req.body.capacity) || 0),
        arcadeEnabled:req.body.arcadeEnabled!==false,
        arcadeMinParticipants:Math.min(50,Math.max(30,Number(req.body.arcadeMinParticipants)||30)),
        active:req.body.active !== false
      },
      {upsert:true,new:true}
    );
    res.status(201).json(cleanEvent(event));
  }catch(e){ next(e); }
});

r.delete('/events/:slug', async (req,res,next)=>{
  try{
    await Event.deleteOne({slug:req.params.slug});
    res.json({ok:true});
  }catch(e){ next(e); }
});

r.post('/banners', async (req,res,next)=>{
  try{
    const banner = await Banner.create({
      title:String(req.body.title || '').trim(),
      text:String(req.body.text || '').trim(),
      cta:String(req.body.cta || 'Join the list').trim(),
      href:String(req.body.href || '#newsletter').trim(),
      placement:String(req.body.placement || 'home').trim(),
      active:req.body.active !== false
    });
    res.status(201).json(banner);
  }catch(e){ next(e); }
});

r.patch('/messages/:id', async (req,res,next)=>{
  try{
    const status = ['new','read','archived'].includes(req.body.status) ? req.body.status : 'read';
    const message = await ContactMessage.findByIdAndUpdate(req.params.id,{status},{new:true});
    res.json(message);
  }catch(e){ next(e); }
});

r.post('/tickets/verify', async (req,res,next)=>{
  try{
    const code = String(req.body.code || '').trim();
    if(!code) return res.status(400).json({error:'Ticket code is required.'});
    const ticket = await Ticket.findOne({$or:[{qrPayload:code},{reference:code.toUpperCase()}]}).select('+qrPayload');
    if(!ticket) return res.status(404).json({error:'Ticket not found.'});
    res.json({ticket:cleanTicket(ticket)});
  }catch(e){ next(e); }
});

r.patch('/tickets/:id/redeem', async (req,res,next)=>{
  try{
    const ticket = await Ticket.findById(req.params.id);
    if(!ticket) return res.status(404).json({error:'Ticket not found.'});
    if(ticket.status === 'cancelled') return res.status(409).json({error:'Cancelled tickets cannot be redeemed.'});
    if(ticket.status === 'redeemed') return res.status(409).json({error:'Ticket was already checked in.'});
    ticket.status = 'redeemed';
    ticket.redeemedAt = new Date();
    await ticket.save();
    res.json({ticket:cleanTicket(ticket)});
  }catch(e){ next(e); }
});

r.patch('/tickets/:id/status', async (req,res,next)=>{
  try{
    const status = ['reserved','cancelled'].includes(req.body.status) ? req.body.status : null;
    if(!status) return res.status(400).json({error:'Unsupported ticket status.'});
    const ticket = await Ticket.findByIdAndUpdate(req.params.id,{status,redeemedAt:null},{new:true});
    if(!ticket) return res.status(404).json({error:'Ticket not found.'});
    res.json({ticket:cleanTicket(ticket)});
  }catch(e){ next(e); }
});

r.post('/gallery', async (req,res,next)=>{
  try{
    const url = String(req.body.url || '').trim();
    const alt = String(req.body.alt || '').trim();
    if(!url || !alt) return res.status(400).json({error:'Image URL and description are required.'});
    if(!url.startsWith('/') && !/^https?:\/\//i.test(url)) return res.status(400).json({error:'Use a local path or an http(s) URL.'});
    const item = await GalleryItem.create({url,alt,order:Number(req.body.order)||0,active:req.body.active !== false});
    res.status(201).json(item);
  }catch(e){ next(e); }
});

r.delete('/gallery/:id', async (req,res,next)=>{
  try{
    await GalleryItem.findByIdAndDelete(req.params.id);
    res.json({ok:true});
  }catch(e){ next(e); }
});

r.put('/site-status', async (req,res,next)=>{
  try{
    const value = {open:req.body.open !== false,message:String(req.body.message || '').trim().slice(0,180)};
    await SiteSetting.findOneAndUpdate({key:'public-status'},{value},{upsert:true,new:true});
    res.json(value);
  }catch(e){ next(e); }
});

r.put('/dating-app', async (req,res,next)=>{
  try{
    const value = {
      enabled:req.body.enabled === true,
      competitionEnabled:req.body.competitionEnabled === true,
      message:String(req.body.message || '').trim().slice(0,180),
      updatedAt:new Date().toISOString()
    };
    if(!value.enabled) value.competitionEnabled=false;
    await SiteSetting.findOneAndUpdate({key:'dating-app'},{value},{upsert:true,new:true});
    res.json(value);
  }catch(e){ next(e); }
});

/* ------------------------------------------------------------------
   Scanner device management. Administrators mint short-lived onboarding
   links and can revoke any door device at any time.
   ------------------------------------------------------------------ */

r.post('/scanner/link', async (req,res,next)=>{
  try{
    const invite = createInvite({
      label: req.body.label,
      eventSlug: req.body.eventSlug || null,
      ttlMinutes: req.body.ttlMinutes,
      sessionDays: req.body.sessionDays
    });
    const base = `${req.protocol}://${req.get('host')}`;
    const url = `${base}/staff/scan?invite=${encodeURIComponent(invite)}`;
    // Rendered so the door phone can be onboarded by pointing its camera at
    // the admin screen: the link never has to travel through a chat app.
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 520, margin: 1, errorCorrectionLevel: 'M',
      color: { dark: '#0a0a0b', light: '#ffffff' }
    });
    res.status(201).json({
      invite, url, qrDataUrl,
      expiresInMinutes: Math.min(24*60, Math.max(1, Number(req.body.ttlMinutes) || 30))
    });
  }catch(e){ next(e); }
});

r.get('/scanner/sessions', async (_req,res,next)=>{
  try{
    const now = new Date();
    const rows = await ScannerSession.find({}).sort({createdAt:-1}).limit(50).lean();
    res.json(rows.map(s=>({
      id:s._id, label:s.label, eventSlug:s.eventSlug,
      status: s.revokedAt ? 'revoked' : (s.expiresAt <= now ? 'expired' : 'active'),
      expiresAt:s.expiresAt, lastSeenAt:s.lastSeenAt,
      scanCount:s.scanCount, admitCount:s.admitCount,
      device:String(s.userAgent||'').slice(0,60)
    })));
  }catch(e){ next(e); }
});

r.post('/scanner/sessions/:id/revoke', async (req,res,next)=>{
  try{
    const s = await ScannerSession.findByIdAndUpdate(req.params.id,{revokedAt:new Date()},{new:true});
    if(!s) return res.status(404).json({error:'Device not found.'});
    res.json({ok:true, id:s._id, status:'revoked'});
  }catch(e){ next(e); }
});

r.get('/scanner/log', async (req,res,next)=>{
  try{
    const limit = Math.min(50,Math.max(5,Number(req.query.limit)||10));
    const total = await ScanLog.countDocuments();
    const pages = Math.max(1,Math.ceil(total/limit));
    const page = Math.min(pages,Math.max(1,Number(req.query.page)||1));
    const rows = await ScanLog.find({})
      .sort({createdAt:-1})
      .skip((page-1)*limit)
      .limit(limit)
      .populate({path:'ticketId',select:'buyerName buyerEmail'})
      .lean();
    res.json({
      items:rows.map(l=>({
        id:l._id,at:l.createdAt,label:l.label,reference:l.reference,
        outcome:l.outcome,eventSlug:l.eventSlug,
        guestName:l.ticketId?.buyerName || null,
        guestEmail:l.ticketId?.buyerEmail || null
      })),
      pagination:{page,pages,limit,total,hasPrevious:page>1,hasNext:page<pages}
    });
  }catch(e){ next(e); }
});

export default r;
