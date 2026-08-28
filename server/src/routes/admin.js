import { Router } from 'express';
import AnalyticsEvent from '../models/AnalyticsEvent.js';
import Banner from '../models/Banner.js';
import ContactMessage from '../models/ContactMessage.js';
import {sendContactReply} from '../services/replyEmail.js';
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
import CustomOrder from '../models/CustomOrder.js';
import ConsentEvent from '../models/ConsentEvent.js';
import {EMAIL_TEMPLATES} from '../services/emailCatalog.js';
import { createInvite } from '../lib/scannerAuth.js';
import QRCode from 'qrcode';
import { requireAdmin } from '../lib/adminAuth.js';
import { currentContest, contestPublic } from '../lib/arcadeContest.js';
import {boundedText,safeImageUrl,safePublicHref} from '../lib/publicContent.js';
import {deliverTicketEmail} from '../services/ticketEmail.js';
import {adminCustomOrder,createCustomOrder,normalizeCustomOrderInput} from '../services/customOrders.js';
import {generateCustomOrderCode,protectCustomOrderCode} from '../lib/customOrderCode.js';
import {allocateVipTables,releaseCustomOrderVipTables} from '../services/vipTables.js';

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
  admissionValid:ticket.admissionValid!==false,
  createdAt:ticket.createdAt
});
const localizedValue=(value,locale='en')=>value?.get?.(locale)||value?.[locale]||value?.get?.('en')||value?.en||'';
const eventDate=value=>{
  const raw=String(value||'').trim();
  // datetime-local carries the venue wall clock without a zone. Store that
  // clock consistently, regardless of the server/container timezone.
  return new Date(/[zZ]$|[+-]\d\d:\d\d$/.test(raw)?raw:`${raw}Z`);
};
const objectId=value=>/^[a-f\d]{24}$/i.test(String(value||'')) ? String(value) : null;
const resendTicketOrders=async(ids,trigger)=>{
  const results=[];
  // Sequential delivery avoids bursts against the email provider and keeps
  // the result tied to the exact order the administrator selected.
  for(const id of ids){
    const result=await deliverTicketEmail(id,{force:true,trigger});
    results.push({orderId:id,status:result.status,sent:result.sent});
  }
  return {
    requested:ids.length,
    sent:results.filter(row=>row.sent).length,
    failed:results.filter(row=>row.status==='failed').length,
    skipped:results.filter(row=>!row.sent&&row.status!=='failed').length,
    results
  };
};

r.get('/banners', async (_req,res,next)=>{
  try{
    const banners = await Banner.find({active:true}).sort({updatedAt:-1}).lean();
    res.json(banners.map(b=>({
      id:b._id, title:b.title, text:b.text, cta:b.cta, href:b.href, placement:b.placement
    })));
  }catch(e){ next(e); }
});

r.use(requireAdmin);

r.get('/custom-orders',async(req,res,next)=>{
  try{
    const expired=await CustomOrder.find({status:'active',expiresAt:{$lte:new Date()}}).select('_id').lean();
    if(expired.length){
      const ids=expired.map(row=>row._id);
      await CustomOrder.updateMany({_id:{$in:ids}},{$set:{status:'expired'},$push:{audit:{action:'expired'}}});
      await Promise.all(ids.map(id=>releaseCustomOrderVipTables(id)));
    }
    const limit=Math.min(50,Math.max(5,Number(req.query.limit)||12));
    const page=Math.max(1,Number(req.query.page)||1);
    const query=String(req.query.query||'').trim();
    const status=String(req.query.status||'').trim();
    const filter={};
    if(status)filter.status=status;
    if(query)filter.$or=[{customerName:{$regex:query,$options:'i'}},{customerEmail:{$regex:query,$options:'i'}},{title:{$regex:query,$options:'i'}},{eventSlug:{$regex:query,$options:'i'}},{codeSuffix:{$regex:query.slice(-6),$options:'i'}}];
    const [total,rows]=await Promise.all([CustomOrder.countDocuments(filter),CustomOrder.find(filter).sort({createdAt:-1}).skip((page-1)*limit).limit(limit)]);
    res.json({items:rows.map(row=>adminCustomOrder(row)),pagination:{page,pages:Math.max(1,Math.ceil(total/limit)),limit,total}});
  }catch(error){next(error);}
});

r.post('/custom-orders',async(req,res,next)=>{
  try{const created=await createCustomOrder(req.body||{},req.admin._id);res.status(201).json({...adminCustomOrder(created.order),code:created.code});}
  catch(error){next(error);}
});

r.get('/custom-orders/:id',async(req,res,next)=>{
  try{const row=await CustomOrder.findById(req.params.id);if(!row)return res.status(404).json({error:'Custom order not found.'});res.json(adminCustomOrder(row));}
  catch(error){next(error);}
});

r.patch('/custom-orders/:id',async(req,res,next)=>{
  try{
    const row=await CustomOrder.findById(req.params.id);
    if(!row)return res.status(404).json({error:'Custom order not found.'});
    if(!['draft','active'].includes(row.status)||row.redemptionCount) return res.status(409).json({error:'A redeemed, reserved, expired, or cancelled custom order cannot be edited.'});
    const payload=normalizeCustomOrderInput(req.body||{});
    await releaseCustomOrderVipTables(row._id);
    Object.assign(row,payload,{updatedBy:req.admin._id,vipReservationTokens:[]});
    if(row.vip.qty&&row.vip.reservationMode==='immediate'){
      const holds=await allocateVipTables(row.eventSlug,row.vip.qty,{customOrderId:row._id,expiresAt:row.expiresAt});
      row.vipReservationTokens=holds.map(item=>item.token);
    }
    row.audit.push({action:'updated',actorId:req.admin._id});
    await row.save();res.json(adminCustomOrder(row));
  }catch(error){next(error);}
});

r.post('/custom-orders/:id/duplicate',async(req,res,next)=>{
  try{
    const source=await CustomOrder.findById(req.params.id).lean();
    if(!source)return res.status(404).json({error:'Custom order not found.'});
    const created=await createCustomOrder({...source,title:`${source.title} copy`,vip:{...source.vip,reservationMode:'checkout'}},req.admin._id);
    res.status(201).json({...adminCustomOrder(created.order),code:created.code});
  }catch(error){next(error);}
});

r.post('/custom-orders/:id/regenerate-code',async(req,res,next)=>{
  try{
    const row=await CustomOrder.findById(req.params.id);
    if(!row)return res.status(404).json({error:'Custom order not found.'});
    if(!['draft','active'].includes(row.status)||row.redemptionCount)return res.status(409).json({error:'Only unused active orders can receive a new code.'});
    const code=generateCustomOrderCode();Object.assign(row,protectCustomOrderCode(code));
    row.audit.push({action:'code_regenerated',actorId:req.admin._id});await row.save();
    res.json({...adminCustomOrder(row),code});
  }catch(error){next(error);}
});

r.post('/custom-orders/:id/cancel',async(req,res,next)=>{
  try{
    const row=await CustomOrder.findOneAndUpdate({_id:req.params.id,status:{$in:['draft','active']}},{$set:{status:'cancelled',updatedBy:req.admin._id},$push:{audit:{action:'cancelled',actorId:req.admin._id}}},{new:true});
    if(!row)return res.status(409).json({error:'This custom order can no longer be cancelled.'});
    await releaseCustomOrderVipTables(row._id);res.json(adminCustomOrder(row));
  }catch(error){next(error);}
});

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
      Ticket.countDocuments({admissionValid:{$ne:false}}),
      Ticket.countDocuments({status:'redeemed',admissionValid:{$ne:false}}),
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
    const [sparkRushSetting,sparkContest]=await Promise.all([
      SiteSetting.findOne({key:'spark-rush'}).lean(),
      currentContest()
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
      sparkRush:{
        enabled:sparkRushSetting?.value?.enabled!==false,
        minParticipants:Math.min(50,Math.max(30,Number(sparkRushSetting?.value?.minParticipants)||30)),
        contest:contestPublic(sparkContest)
      },
      feedback,
      orders:recentOrders.map(order=>({
        id:order._id,eventSlug:order.eventSlug,tier:order.tier,qty:order.qty,total:order.total,
        tableCount:order.tableCount||0,vipTableSlots:order.vipTableSlots||[],vipDiscountPercent:order.vipDiscountPercent||0,
        code:order.code,email:order.email,buyerName:order.buyerName,paymentStatus:order.paymentStatus,
        status:order.status,emailStatus:order.emailStatus,emailResendCount:order.emailResendCount||0,
        emailLastResentAt:order.emailLastResentAt,emailLastResendError:order.emailLastResendError,createdAt:order.createdAt
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
        status:order.status,emailStatus:order.emailStatus,emailResendCount:order.emailResendCount||0,
        emailLastResentAt:order.emailLastResentAt,emailLastResendError:order.emailLastResendError,createdAt:order.createdAt
      })),
      pagination:{page,pages,limit,total,hasPrevious:page>1,hasNext:page<pages}
    });
  }catch(e){ next(e); }
});

r.post('/orders/resend-tickets',async(req,res,next)=>{
  try{
    const scope=req.body?.scope==='all'?'all':'selected';
    let ids=[];
    if(scope==='all'){
      const issuedOrderIds=await Ticket.distinct('orderId',{orderId:{$ne:null}});
      const rows=await Order.find({_id:{$in:issuedOrderIds},status:'paid'}).select('_id').sort({createdAt:1}).lean();
      ids=rows.map(row=>String(row._id));
    }else{
      ids=[...new Set((Array.isArray(req.body?.orderIds)?req.body.orderIds:[]).map(objectId).filter(Boolean))].slice(0,200);
      if(!ids.length)return res.status(400).json({error:'Choose at least one paid order to resend.'});
      const issued=await Ticket.distinct('orderId',{orderId:{$in:ids}});
      const rows=await Order.find({_id:{$in:issued},status:'paid'}).select('_id').lean();
      const eligible=new Set(rows.map(row=>String(row._id)));
      ids=ids.filter(id=>eligible.has(id));
    }
    if(!ids.length)return res.status(409).json({error:'No paid orders with issued tickets are available to resend.'});
    res.json(await resendTicketOrders(ids,`admin:${req.admin._id}:${scope}`));
  }catch(error){next(error);}
});

r.post('/orders/:id/resend-tickets',async(req,res,next)=>{
  try{
    const id=objectId(req.params.id);
    if(!id)return res.status(400).json({error:'Invalid order identifier.'});
    const [order,ticketCount]=await Promise.all([
      Order.findOne({_id:id,status:'paid'}).select('_id email').lean(),
      Ticket.countDocuments({orderId:id})
    ]);
    if(!order||!ticketCount)return res.status(404).json({error:'Paid order with issued tickets not found.'});
    const result=await deliverTicketEmail(id,{force:true,trigger:`admin:${req.admin._id}:individual`});
    if(!result.sent)return res.status(result.status==='already_handled'?409:502).json({error:result.status==='already_handled'?'A ticket email is already being sent for this order.':'The ticket email could not be sent.',status:result.status});
    res.json({requested:1,sent:1,failed:0,skipped:0,orderId:id});
  }catch(error){next(error);}
});

r.post('/events', async (req,res,next)=>{
  try{
    const slug = String(req.body.slug || req.body.title || '')
      .trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    const date = eventDate(req.body.date);
    if(!slug || !req.body.title || Number.isNaN(date.getTime())) {
      return res.status(400).json({error:'Title, slug and a valid date are required.'});
    }
    const event = await Event.findOneAndUpdate(
      {slug},
      {
        slug,
        date,
        title:boundedText(req.body.title,160),
        support:boundedText(req.body.support,240),
        room:boundedText(req.body.room || 'Main Hall',160),
        address:boundedText(req.body.address,300),
        description:boundedText(req.body.description,3000),
        image:safeImageUrl(req.body.image),
        tags:String(req.body.tags || '').split(',').map(s=>s.trim().slice(0,60)).filter(Boolean).slice(0,20),
        badges:String(req.body.badges || '').split(',').map(s=>s.trim().slice(0,60)).filter(Boolean).slice(0,20),
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
    await currentContest();
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
      title:boundedText(req.body.title,160),
      text:boundedText(req.body.text,1000),
      cta:boundedText(req.body.cta || 'Join the list',80),
      href:safePublicHref(req.body.href,'/newsletter'),
      placement:boundedText(req.body.placement || 'home',40),
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

/**
 * Reply to an enquiry.
 *
 * The reply is recorded on the enquiry whether or not delivery succeeds, so a
 * failed send is visible in the admin rather than looking like it was never
 * written. A duplicate of the last reply is refused: a double click must not
 * email the same person twice.
 */
r.post('/messages/:id/reply', async (req,res,next)=>{
  try{
    const body = String(req.body?.body || '').trim();
    if(body.length < 2)
      return res.status(400).json({error:'Write a reply before sending.',code:'EMPTY_REPLY'});
    if(body.length > 4000)
      return res.status(400).json({error:'Replies are limited to 4000 characters.',code:'REPLY_TOO_LONG'});

    const message = await ContactMessage.findById(req.params.id);
    if(!message) return res.status(404).json({error:'That message no longer exists.',code:'NOT_FOUND'});

    const last = message.replies?.[message.replies.length - 1];
    if(last && last.body === body && Date.now() - new Date(last.sentAt).getTime() < 60_000)
      return res.status(409).json({error:'That reply was just sent.',code:'DUPLICATE_REPLY'});

    const subject = String(req.body?.subject || '').trim()
      || `Re: ${message.subject || 'Your message to Project ISKRA'}`;
    const sentBy = req.admin?.email || 'admin';

    let outcome;
    try{
      outcome = await sendContactReply({
        to: message.email, name: message.name, subject, body,
        original: message.message
      });
    }catch(error){
      // Recorded as failed, not lost, so the team can see it and retry.
      message.replies.push({body, sentBy, deliveryStatus:'failed', error:String(error.message).slice(0,300)});
      await message.save();
      return res.status(502).json({error:`Could not send: ${error.message}`,code:'SEND_FAILED'});
    }

    message.replies.push({body, sentBy, emailId:outcome.id || null, deliveryStatus:'sent'});
    message.status = 'replied';
    message.repliedAt = new Date();
    await message.save();

    res.status(201).json({ok:true, status:message.status, replies:message.replies, emailId:outcome.id || null});
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
    if(ticket.admissionValid===false) return res.status(409).json({error:'A VIP table reservation cannot be redeemed as admission.'});
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
    const url = safeImageUrl(req.body.url);
    const alt = boundedText(req.body.alt,300);
    if(!url || !alt) return res.status(400).json({error:'Image URL and description are required.'});
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

r.put('/spark-rush', async (req,res,next)=>{
  try{
    const value={
      enabled:req.body.enabled===true,
      minParticipants:Math.min(50,Math.max(30,Number(req.body.minParticipants)||30)),
      updatedAt:new Date().toISOString()
    };
    await SiteSetting.findOneAndUpdate({key:'spark-rush'},{value},{upsert:true,new:true});
    const contest=value.enabled?await currentContest():null;
    res.json({...value,contest:contestPublic(contest)});
  }catch(e){next(e);}
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
