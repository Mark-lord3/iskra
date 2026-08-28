import { randomBytes, randomUUID } from 'node:crypto';
import { Router } from 'express';
import mongoose from 'mongoose';
import QRCode from 'qrcode';
import Stripe from 'stripe';
import {stripeEnv} from '../config/stripe.js';
import Event from '../models/Event.js';
import Order from '../models/Order.js';
import Player from '../models/Player.js';
import PromoCode from '../models/PromoCode.js';
import Ticket from '../models/Ticket.js';
import Membership from '../models/Membership.js';
import User from '../models/User.js';
import ArcadeEntry from '../models/ArcadeEntry.js';
import CustomOrder from '../models/CustomOrder.js';
import VipTableReservation from '../models/VipTableReservation.js';
import { PRIZES } from '../lib/prizes.js';
import {optionalAccount} from '../lib/accountAuth.js';
import {quote as priceQuote, vipTableQuote, customOrderQuote, clampQty, tierPrice, tierAvailability, nextUnlock, MAX_QTY, VIP_TABLE_PRICE, VIP_TABLE_SEATS} from '../../../shared/pricing.js';
import { deliverTicketEmail } from '../services/ticketEmail.js';
import {allocateVipTable,allocateVipTables,attachVipTable,attachVipTables,markVipTablePaid,releaseVipTable,releaseCustomCheckoutVipTables,vipAvailability} from '../services/vipTables.js';
import {findCustomOrderByCode,publicCustomOrder} from '../services/customOrders.js';

const r = Router();
r.use(optionalAccount);

async function resolveCustomOrder(rawCode,eventSlug,email,promoCode,{requireEmail=false}={}){
  const custom=await findCustomOrderByCode(rawCode);
  if(!custom)return null;
  if(custom.status!=='active')throw Object.assign(new Error(custom.status==='expired'?'This custom order has expired.':'This custom order is no longer available.'),{status:409,code:'CUSTOM_ORDER_UNAVAILABLE'});
  if(custom.redemptionCount>=custom.maxRedemptions)throw Object.assign(new Error('This custom order has already been used.'),{status:409,code:'CUSTOM_ORDER_USED'});
  if(eventSlug&&custom.eventSlug!==eventSlug)throw Object.assign(new Error('This custom order belongs to a different event.'),{status:400,code:'CUSTOM_ORDER_EVENT'});
  const normalizedEmail=String(email||'').trim().toLowerCase();
  if(custom.restrictEmail&&((requireEmail&&!normalizedEmail)||(normalizedEmail&&normalizedEmail!==custom.customerEmail)))
    throw Object.assign(new Error('Use the email address assigned to this custom order.'),{status:403,code:'CUSTOM_ORDER_EMAIL'});
  const event=await Event.findOne({slug:custom.eventSlug,active:{$ne:false}}).lean();
  if(!event)throw Object.assign(new Error('The event for this custom order is unavailable.'),{status:404,code:'NO_EVENT'});
  const promo=custom.allowPromoStacking&&promoCode?await discountFor(promoCode,event.slug):null;
  if(promoCode&&!promo)throw Object.assign(new Error('That promo code is no longer valid.'),{status:400,code:'PROMO_NOT_APPLICABLE'});
  const pricing=customOrderQuote({admission:custom.admission,vip:custom.vip,promo,allowPromoStacking:custom.allowPromoStacking});
  return {custom,event,promo,pricing};
}

r.post('/custom-order/preview',async(req,res,next)=>{
  try{
    const resolved=await resolveCustomOrder(req.body?.code,req.body?.eventSlug,req.body?.email,req.body?.promoCode);
    if(!resolved)return res.status(404).json({error:'Custom order code not found.',code:'CUSTOM_ORDER_NOT_FOUND'});
    res.json(publicCustomOrder(resolved.custom,resolved.event,resolved.pricing));
  }catch(error){next(error);}
});

/**
 * Authoritative pricing.
 *
 * The offers calculator does its own arithmetic with the same shared module so
 * it can react instantly, then confirms the figure here. If the two ever
 * disagree the server's answer is the one shown, because the server is what
 * charges the card.
 */
r.post('/quote', async (req,res,next)=>{
  try{
    const includeVip = Boolean(req.body?.includeVip) || req.body?.tierKey === 'booth';
    const admissionTierKey = ['general','early'].includes(req.body?.admissionTierKey)
      ? req.body.admissionTierKey
      : ['general','early'].includes(req.body?.tierKey) ? req.body.tierKey : 'general';
    const qty = includeVip
      ? Math.min(VIP_TABLE_SEATS,Math.max(1,Math.floor(Number(req.body?.qty)||1)))
      : clampQty(req.body?.qty);
    const tierKey = includeVip ? 'booth' : admissionTierKey;
    const event = await Event.findOne({slug:String(req.body?.eventSlug || ''),active:{$ne:false}}).lean();
    if(!event) return res.status(404).json({error:'This event is not available.',code:'NO_EVENT'});

    const raw = String(req.body?.code || '').trim().toUpperCase();
    const promo = raw ? await discountFor(raw,event.slug) : null;
    if(raw && !promo)
      return res.status(200).json({...priceQuote({base:event.from,tierKey,qty}),
        eventSlug:event.slug,eventTitle:event.title,
        codeError:{code:'UNKNOWN_CODE',message:'That code is not valid.'}});

    const availability=tierAvailability(event.date,new Date());
    const vip=tierKey==='booth'?await vipAvailability(event.slug):null;
    if(vip&&!vip.nextSlot)return res.status(409).json({error:'VIP tables are sold out for this event.',code:'VIP_SOLD_OUT'});
    const priced=includeVip
      ? vipTableQuote({base:event.from,admissionTierKey,admissionQty:qty,tableSlot:vip.nextSlot})
      : priceQuote({base:event.from,tierKey,qty,promo});

    /* What the visitor would need to unlock the next public offer. Reward codes
       stay private: only campaign codes are ever listed here. */
    const now = new Date();
    const campaigns = await PromoCode.find({active:true,public:{$ne:false}})
      .select('code label off flat minQty maxQty stackable startsAt expiresAt kind appliesTo').lean();
    const live = campaigns
      .filter(c => (!c.startsAt || c.startsAt <= now) && (!c.expiresAt || c.expiresAt >= now))
      .map(c => ({code:c.code,label:c.label,minQty:c.minQty || 1,
                  percentOff:c.off ? Math.round(c.off*100) : 0,kind:c.kind,status:'live'}));

    res.json({
      ...priced,
      eventSlug:event.slug, eventTitle:event.title, tierKey, admissionTierKey, includeVip,
      basePrice:event.from,
      tierAvailability:tierAvailability(event.date,now),
      vip,
      nextUnlock:tierKey === 'booth' ? null : nextUnlock(live,qty),
      offers:tierKey === 'booth' ? [] : live,
      maxQty:MAX_QTY,
      serverTime:now
    });
  }catch(e){ next(e); }
});

r.get('/vip-availability',async(req,res,next)=>{
  try{
    const event=await Event.findOne({slug:String(req.query.eventSlug||''),active:{$ne:false}}).lean();
    if(!event)return res.status(404).json({error:'This event is not available.',code:'NO_EVENT'});
    res.json(await vipAvailability(event.slug));
  }catch(error){next(error);}
});

const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
const CURRENCY = 'cad';
const TIERS = {
  general:{label:'Early bird',price:base=>base},
  early:{label:'Late bird',price:base=>Math.round(base * 1.2)},
  booth:{label:'VIP table',price:()=>VIP_TABLE_PRICE}
};
const deliverEmailSafely=async orderId=>{
  try{ return await deliverTicketEmail(orderId); }
  catch(error){
    console.error(`Ticket email delivery crashed for order ${orderId}:`,error.message);
    return {sent:false,status:'failed'};
  }
};

const stripeClient = () => {
  const {secretKey}=stripeEnv();
  if(!secretKey){
    const error = new Error('Stripe is not configured. Add STRIPE_SECRET_KEY to server/.env.');
    error.status = 503;
    throw error;
  }
  return new Stripe(secretKey);
};

const publicTicket = async ticket => ({
  id:ticket._id,reference:ticket.reference,eventSlug:ticket.eventSlug,
  eventTitle:ticket.eventTitle,eventDate:ticket.eventDate,room:ticket.room,
  buyerName:ticket.buyerName,tier:ticket.tier,price:ticket.price,
  status:ticket.status,redeemedAt:ticket.redeemedAt,admissionValid:ticket.admissionValid!==false,
  qrDataUrl:await QRCode.toDataURL(ticket.qrPayload,{width:560,margin:2,errorCorrectionLevel:'M'})
});

async function discountFor(rawCode, eventSlug){
  const code = String(rawCode || '').trim().toUpperCase();
  if(!code) return null;
  const now = new Date();
  const promo = await PromoCode.findOne({code,active:true}).lean();
  if(promo){
    // Scope and window are decided here, never by the browser.
    const scope = String(promo.appliesTo || 'all').trim();
    const covers = !scope || scope === 'all' || !eventSlug
      || scope.split(',').map(v=>v.trim()).filter(Boolean).includes(String(eventSlug));
    const status = promo.startsAt && promo.startsAt > now ? 'scheduled'
                 : promo.expiresAt && promo.expiresAt < now ? 'expired' : 'live';
    if(!covers) return {code,off:0,flat:0,minQty:1,maxQty:0,label:promo.label,status:'not_eligible',stackable:true};
    return {code,off:promo.off,flat:promo.flat,minQty:promo.minQty || 1,maxQty:promo.maxQty,
            label:promo.label,status,stackable:promo.stackable !== false};
  }
  const player = await Player.findOne({rewardCode:code,rewardRedeemed:false}).lean();
  const entry=await ArcadeEntry.findOne({rewardCode:code,rewardRedeemed:false}).populate('contest').lean();
  if(entry){
    if(entry.eventSlug!==eventSlug||entry.contest?.status!=='finalized'||new Date(entry.contest.eventDate)<=now)return null;
    const prize=PRIZES[entry.rewardTier]||PRIZES.played;
    return {code,off:prize.off||0,flat:prize.flat||0,minQty:1,maxQty:prize.maxQty,
      label:prize.label,status:'live',stackable:false,eventSlug:entry.eventSlug};
  }
  if(!player) return null;
  const prize = PRIZES[player.rewardTier] || PRIZES.played;
  return {code,off:prize.off || 0,flat:prize.flat || 0,minQty:1,maxQty:prize.maxQty,
          label:prize.label,status:'live',stackable:true};
}

async function pricedOrder(body){
  const buyerName = String(body.buyerName || '').trim().slice(0,100);
  const buyerEmail = String(body.buyerEmail || '').trim().toLowerCase();
  const customCode=String(body.customOrderCode||'').trim();
  if(customCode){
    if(buyerName.length < 2) throw Object.assign(new Error('Enter the ticket holder name.'),{status:400});
    if(!EMAIL.test(buyerEmail)) throw Object.assign(new Error('Enter a valid email address.'),{status:400});
    const resolved=await resolveCustomOrder(customCode,body.eventSlug,buyerEmail,body.code,{requireEmail:true});
    if(!resolved)throw Object.assign(new Error('Custom order code not found.'),{status:404,code:'CUSTOM_ORDER_NOT_FOUND'});
    const {custom,event,promo,pricing}=resolved;
    const issued=await Ticket.countDocuments({eventSlug:event.slug,status:{$ne:'cancelled'},admissionValid:{$ne:false}});
    if(event.capacity>0&&event.capacity-issued<pricing.admissionQty)throw Object.assign(new Error('This event no longer has enough admission inventory for the custom order.'),{status:409,code:'CAPACITY_CHANGED'});
    return {event,buyerName,buyerEmail,qty:Math.max(1,pricing.admissionQty),tierKey:'custom',admissionTierKey:custom.admission.tierKey,
      includeVip:pricing.vipQty>0,tier:{label:custom.title},reservation:null,reservations:[],unit:pricing.admissionUnit,
      subtotal:pricing.subtotal,total:pricing.total,discount:promo,priced:pricing,customOrder:custom};
  }
  const includeVip=Boolean(body.includeVip)||body.tierKey==='booth';
  const admissionTierKey=['general','early'].includes(body.admissionTierKey)
    ? body.admissionTierKey
    : ['general','early'].includes(body.tierKey)?body.tierKey:'general';
  const requestedTierKey=includeVip?'booth':admissionTierKey;
  const qty=includeVip
    ? Math.min(VIP_TABLE_SEATS,Math.max(1,Math.floor(Number(body.qty)||1)))
    : clampQty(body.qty);
  if(buyerName.length < 2) throw Object.assign(new Error('Enter the ticket holder name.'),{status:400});
  if(!EMAIL.test(buyerEmail)) throw Object.assign(new Error('Enter a valid email address.'),{status:400});

  const event = await Event.findOne({slug:body.eventSlug,active:{$ne:false}}).lean();
  if(!event) throw Object.assign(new Error('This event is not available.'),{status:404});

  const issued = await Ticket.countDocuments({eventSlug:event.slug,status:{$ne:'cancelled'},admissionValid:{$ne:false}});
  const held = await Order.aggregate([
    {$match:{eventSlug:event.slug,status:'pending',createdAt:{$gte:new Date(Date.now()-31*60_000)}}},
    {$group:{_id:null,qty:{$sum:{$cond:[{$ifNull:['$customOrderId',false]},'$admissionQty','$qty']}}}}
  ]);
  const remaining = event.capacity > 0 ? event.capacity - issued - (held[0]?.qty || 0) : Infinity;
  if(remaining < qty) throw Object.assign(new Error(`Only ${Math.max(0,remaining)} ticket(s) remain.`),{status:409});

  const tierKey = requestedTierKey;
  const tier = TIERS[tierKey];
  const availability = tierAvailability(event.date,new Date());
  const availabilityKey=includeVip?admissionTierKey:tierKey;
  if(!availability[availabilityKey]){
    const message = availabilityKey === 'general'
      ? 'Early bird sales have ended. Choose Late bird.'
      : 'Late bird tickets become available on the event date.';
    throw Object.assign(new Error(message),{status:409,code:'TIER_NOT_AVAILABLE'});
  }
  if(tierKey==='booth'&&body.code)
    throw Object.assign(new Error('Promo codes cannot be used for VIP tables.'),{status:400,code:'PROMO_NOT_APPLICABLE'});
  const discount = tierKey==='booth'?null:await discountFor(body.code,event.slug);
  if(body.code && !discount) throw Object.assign(new Error('That promo code is no longer valid.'),{status:400});

  /* One shared calculation for the calculator and for the charge, so a price
     shown on the offers page is the price actually taken. */
  let reservation=null;
  let priced;
  if(tierKey==='booth'){
    reservation=await allocateVipTable(event.slug);
    const actualDiscount=Math.round((reservation.slot<=2?0.20:0.40)*100);
    const expected=Number(body.vipExpectedDiscount)||0;
    if(expected&&expected!==actualDiscount){
      await releaseVipTable({token:reservation.token});
      throw Object.assign(new Error('VIP table availability changed. Review the updated discount and try again.'),{status:409,code:'VIP_AVAILABILITY_CHANGED'});
    }
    priced=vipTableQuote({base:event.from,admissionTierKey,admissionQty:qty,tableSlot:reservation.slot});
  }else{
    priced=priceQuote({base:event.from,tierKey,qty,promo:discount});
  }

  // A code the visitor asked for but which does not apply is refused loudly
  // rather than silently dropped from the total.
  if(discount && !priced.promo.applied){
    const reason = priced.promo.reason;
    const message = reason === 'MIN_QTY'
      ? `${discount.code} needs ${priced.promo.minQty} tickets. Add ${priced.promo.need} more ticket${priced.promo.need === 1 ? '' : 's'}.`
      : reason === 'VIP_EXCLUDED' ? 'Promo codes cannot be used for VIP tables.'
      : reason === 'EXPIRED' ? 'That promo code has expired.'
      : reason === 'NOT_STARTED' ? 'That promo code is not active yet.'
      : 'That promo code does not apply to this event.';
    throw Object.assign(new Error(message),{status:400,code:'PROMO_NOT_APPLICABLE'});
  }

  const finalTier=tierKey==='booth'
    ? {...tier,label:`VIP table #${reservation.slot} + ${TIERS[priced.admissionTierKey].label} admission`}
    : tier;
  return {event,buyerName,buyerEmail,qty,tierKey,admissionTierKey,includeVip,tier:finalTier,reservation,
          unit:priced.unit,subtotal:priced.subtotal,total:priced.total,discount,priced};
}

async function ticketsForOrder(order){
  const tickets = await Ticket.find({orderId:order._id}).select('+accessToken +qrPayload').sort({createdAt:1});
  return Promise.all(tickets.map(async ticket=>({...await publicTicket(ticket),accessToken:ticket.accessToken})));
}

async function checkoutResult(orderId,tickets){
  const order=await Order.findById(orderId).select('emailStatus').lean();
  return {ok:true,tickets,emailStatus:order?.emailStatus || 'pending'};
}

async function fulfill(orderId,session=null){
  let order = await Order.findById(orderId);
  if(!order) throw Object.assign(new Error('Order not found.'),{status:404});
    if(order.status === 'paid'){
      if(order.tierKey==='booth'||order.customOrderId)await markVipTablePaid(order._id);
    const tickets=await ticketsForOrder(order);
    await deliverEmailSafely(order._id);
    return tickets;
  }

  const claimed = await Order.findOneAndUpdate(
    {_id:orderId,status:'pending'},
    {$set:{status:'processing',paymentStatus:session?.payment_status || order.paymentStatus,
      paymentIntentId:String(session?.payment_intent || order.paymentIntentId || '') || null}},
    {new:true}
  );
  if(!claimed){
    for(let attempt=0;attempt<15;attempt+=1){
      await new Promise(resolve=>setTimeout(resolve,100));
      order = await Order.findById(orderId);
      if(order?.status === 'paid'){
        const tickets=await ticketsForOrder(order);
        await deliverEmailSafely(order._id);
        return tickets;
      }
      if(order?.status !== 'processing') break;
    }
    throw Object.assign(new Error('Payment is still being finalized. Refresh in a moment.'),{status:409});
  }

  try{
    const event = await Event.findOne({slug:claimed.eventSlug}).lean();
    if(!event) throw new Error('The purchased event no longer exists.');
    const ticketCount=claimed.customOrderId?(claimed.customOrderSnapshot?.admission?.qty||0):claimed.tierKey==='booth'?(claimed.admissionQty||0):claimed.qty;
    const docs = Array.from({length:Math.max(1,ticketCount)},(_,index)=>{
      const reference = `ISKRA-${randomUUID().replaceAll('-','').slice(0,12).toUpperCase()}`;
      const accessToken = randomBytes(24).toString('hex');
      const qrSecret = randomBytes(18).toString('base64url');
      return {
        reference,accessToken,qrSecret,qrPayload:`ISKRA:${reference}:${qrSecret}`,
        eventSlug:event.slug,eventTitle:event.title,eventDate:event.date,room:event.room,
        buyerName:claimed.buyerName,buyerEmail:claimed.email,tier:claimed.tier,
        price:index<ticketCount?(claimed.tierKey==='booth'||claimed.customOrderId)?claimed.admissionUnitPrice:claimed.total/claimed.qty:0,
        admissionValid:index<ticketCount,orderId:claimed._id,userId:claimed.userId,
        stripeSessionId:claimed.stripeSessionId
      };
    });
    await Ticket.create(docs);
    await Order.updateOne({_id:claimed._id},{$set:{status:'paid',paymentStatus:session?.payment_status || 'paid'}});
    if(claimed.tierKey==='booth'||claimed.customOrderId)await markVipTablePaid(claimed._id);
    if(claimed.customOrderId)await CustomOrder.updateOne({_id:claimed.customOrderId,reservedOrderId:claimed._id},[
      {$set:{redemptionCount:{$add:['$redemptionCount',1]},usedAt:new Date(),reservedAt:null,
        status:{$cond:[{$gte:[{$add:['$redemptionCount',1]},'$maxRedemptions']},'redeemed','active']}}}
    ]);
    if(claimed.code){
      await Promise.all([
        PromoCode.updateOne({code:claimed.code,singleUse:true},{$set:{active:false}}),
        Player.updateOne({rewardCode:claimed.code},{$set:{rewardRedeemed:true}}),
        ArcadeEntry.updateOne({rewardCode:claimed.code,eventSlug:claimed.eventSlug,rewardOrderId:claimed._id},{$set:{rewardRedeemed:true},$unset:{rewardReservedAt:1}})
      ]);
    }
    const tickets=await ticketsForOrder(claimed);
    await deliverEmailSafely(claimed._id);
    return tickets;
  }catch(error){
    await Order.updateOne({_id:claimed._id},{$set:{status:'pending'}});
    throw error;
  }
}

r.post('/checkout',async(req,res,next)=>{
  let order;
  let pendingOrderId=null;
  let vipReservationToken=null;
  let customOrderId=null;
  let customOrderExpiresAt=null;
  let customReservationTokens=[];
  let customReservationMode=null;
  try{
    const priced = await pricedOrder(req.body || {});
    const orderId=new mongoose.Types.ObjectId();
    pendingOrderId=orderId;
    let reservations=priced.reservation?[priced.reservation]:[];
    if(priced.customOrder){
      customOrderId=priced.customOrder._id;
      customOrderExpiresAt=priced.customOrder.expiresAt||null;
      customReservationMode=priced.customOrder.vip.reservationMode;
      const claimed=await CustomOrder.findOneAndUpdate({_id:customOrderId,status:'active',redemptionCount:{$lt:priced.customOrder.maxRedemptions},reservedOrderId:null},
        {$set:{status:'reserved',reservedOrderId:orderId,reservedAt:new Date()},$push:{audit:{action:'checkout_reserved',details:{orderId:String(orderId)}}}},{new:true});
      if(!claimed)throw Object.assign(new Error('This custom order is already in another checkout.'),{status:409,code:'CUSTOM_ORDER_RESERVED'});
      if(priced.priced.vipQty){
        reservations=claimed.vip.reservationMode==='immediate'
          ? await VipTableReservation.find({customOrderId:claimed._id,token:{$in:claimed.vipReservationTokens},status:'pending',orderId:null})
          : await allocateVipTables(priced.event.slug,priced.priced.vipQty);
        if(reservations.length!==priced.priced.vipQty)throw Object.assign(new Error('The reserved VIP inventory is no longer available.'),{status:409,code:'VIP_AVAILABILITY_CHANGED'});
      }
      customReservationTokens=reservations.map(item=>item.token);
    }
    vipReservationToken=reservations[0]?.token||null;
    order = await Order.create({
      _id:orderId,
      eventSlug:priced.event.slug,tier:priced.tier.label,tierKey:priced.tierKey,qty:priced.qty,
      tableCount:priced.customOrder?priced.priced.vipQty:priced.tierKey==='booth'?1:0,
      vipTableSlots:reservations.map(item=>item.slot),vipDiscountPercent:priced.priced.discountPercent||0,
      admissionQty:priced.customOrder?priced.priced.admissionQty:priced.tierKey==='booth'?priced.qty:0,
      admissionTierKey:(priced.tierKey==='booth'||priced.customOrder)?priced.admissionTierKey:null,
      admissionUnitPrice:priced.customOrder?priced.priced.admissionUnit:priced.tierKey==='booth'?priced.priced.admissionTotal/priced.qty:0,
      vipReservationToken,vipReservationTokens:reservations.map(item=>item.token),
      subtotal:priced.subtotal,total:priced.total,code:priced.discount?.code || null,
      customOrderId:priced.customOrder?._id||null,
      customOrderSnapshot:priced.customOrder?{title:priced.customOrder.title,description:priced.customOrder.description,
        admission:{qty:priced.priced.admissionQty,tierKey:priced.admissionTierKey,unitPrice:priced.priced.admissionUnit,total:priced.priced.lines.find(line=>line.type==='admission')?.total||0},
        vip:{qty:priced.priced.vipQty,unitPrice:priced.priced.vipUnit,total:priced.priced.lines.find(line=>line.type==='vip')?.total||0,inclusions:priced.customOrder.vip.inclusions},
        pricing:priced.priced}:null,
      playerId:req.body.playerId || null,userId:req.account?._id || null,
      email:priced.buyerEmail,buyerName:priced.buyerName,
      locale:['en','uk','ru'].includes(req.body.locale) ? req.body.locale : 'en',
      currency:CURRENCY,status:'pending',paymentStatus:priced.total === 0 ? 'no_payment_required' : 'unpaid'
    });
    if(reservations.length)await attachVipTables(reservations.map(item=>item.token),order._id);
    if(priced.discount?.code){
      const reward=await ArcadeEntry.findOne({rewardCode:priced.discount.code}).select('_id').lean();
      if(reward){
        const stale=new Date(Date.now()-31*60_000);
        const reserved=await ArcadeEntry.findOneAndUpdate({
          _id:reward._id,rewardRedeemed:false,
          $or:[{rewardOrderId:null},{rewardReservedAt:{$lt:stale}}]
        },{$set:{rewardOrderId:order._id,rewardReservedAt:new Date()}},{new:true});
        if(!reserved)throw Object.assign(new Error('That game reward is already reserved by another checkout.'),{status:409,code:'REWARD_RESERVED'});
      }
    }
    if(priced.total === 0){
      const tickets=await fulfill(order._id);
      return res.status(201).json(await checkoutResult(order._id,tickets));
    }

    const allowedOrigins=(process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(value=>value.trim().replace(/\/$/,'')).filter(Boolean);
    const requestOrigin=String(req.get('origin') || '').replace(/\/$/,'');
    const isLocalRequest=process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(requestOrigin);
    const origin=allowedOrigins.includes(requestOrigin) || isLocalRequest
      ? requestOrigin
      : allowedOrigins.find(value=>value.startsWith('https://')) || allowedOrigins[0];
    const stripeLineItems=priced.customOrder
      ? priced.priced.lines.filter(line=>line.total>0).map(line=>({quantity:1,price_data:{currency:CURRENCY,unit_amount:Math.round(line.total*100),
          product_data:{name:line.type==='admission'?`${priced.customOrder.title} · admission`:`${priced.customOrder.title} · VIP`,
            description:line.type==='admission'?`${line.qty} ${TIERS[priced.admissionTierKey].label} ticket${line.qty===1?'':'s'}`:`${line.qty} VIP table${line.qty===1?'':'s'} · ${priced.customOrder.vip.inclusions.join(' · ')}`}}}))
      : priced.tierKey==='booth'
      ? [
          {quantity:1,price_data:{currency:CURRENCY,unit_amount:Math.round(priced.priced.admissionTotal*100),
            product_data:{name:`${TIERS[priced.admissionTierKey].label} admission tickets`,description:`${priced.event.title} · ${priced.qty} entry ticket${priced.qty===1?'':'s'}`}}},
          {quantity:1,price_data:{currency:CURRENCY,unit_amount:Math.round(priced.priced.tablePrice*100),
            product_data:{name:`VIP table #${priced.reservation.slot}`,description:`${priced.event.title} · seats four · bottle 20% off`}}}
        ]
      : [{quantity:1,price_data:{currency:CURRENCY,unit_amount:Math.round(priced.total*100),
          product_data:{name:priced.event.title,description:`${priced.qty} x ${priced.tier.label}`}}}];
    const customMetadata=priced.customOrder?{
      customOrderId:String(priced.customOrder._id),customOrderTitle:priced.customOrder.title.slice(0,500),
      vipInclusions:priced.customOrder.vip.inclusions.join(' | ').slice(0,500)
    }:{};
    const session = await stripeClient().checkout.sessions.create({
      mode:'payment',customer_email:priced.buyerEmail,client_reference_id:String(order._id),
      line_items:stripeLineItems,
      metadata:{orderId:String(order._id),eventSlug:priced.event.slug,quantity:String(priced.qty),...customMetadata},
      payment_intent_data:{receipt_email:priced.buyerEmail,metadata:{orderId:String(order._id),...customMetadata}},
      success_url:`${origin}/tickets?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:`${origin}/schedule?checkout=cancelled`,
      expires_at:Math.floor(Date.now()/1000)+31*60
    });
    order.stripeSessionId=session.id;
    await order.save();
    res.status(201).json({ok:true,checkoutUrl:session.url});
  }catch(error){
    if(order?._id)await Promise.all([
      Order.updateOne({_id:order._id},{$set:{status:'failed'}}).catch(()=>{}),
      ArcadeEntry.updateOne({rewardOrderId:order._id,rewardRedeemed:false},{$set:{rewardOrderId:null,rewardReservedAt:null}}).catch(()=>{})
    ]);
    if(order?.customOrderId)await releaseCustomCheckoutVipTables({orderId:order._id,customOrderId:order.customOrderId,expiresAt:customOrderExpiresAt}).catch(()=>{});
    else if(customOrderId&&customReservationMode==='checkout')await Promise.all(customReservationTokens.map(token=>releaseVipTable({token}).catch(()=>{})));
    else await releaseVipTable(order?{orderId:order._id}:{token:vipReservationToken}).catch(()=>{});
    if(customOrderId&&pendingOrderId)await CustomOrder.updateOne({_id:customOrderId,reservedOrderId:pendingOrderId},{$set:{status:'active',reservedOrderId:null,reservedAt:null},$push:{audit:{action:'checkout_released',details:{reason:'checkout_error'}}}}).catch(()=>{});
    next(error);
  }
});

r.get('/checkout/complete',async(req,res,next)=>{
  try{
    const sessionId=String(req.query.sessionId || '');
    if(!sessionId.startsWith('cs_')) return res.status(400).json({error:'Invalid checkout session.'});
    const session=await stripeClient().checkout.sessions.retrieve(sessionId);
    const order=await Order.findOne({stripeSessionId:session.id});
    if(!order || String(order._id)!==session.metadata?.orderId) return res.status(404).json({error:'Order not found.'});
    if(!['paid','no_payment_required'].includes(session.payment_status)) return res.status(402).json({error:'Payment has not completed.'});
    const tickets=await fulfill(order._id,session);
    res.json(await checkoutResult(order._id,tickets));
  }catch(error){ next(error); }
});

r.post('/reserve',(_req,res)=>res.status(410).json({error:'Direct reservations are disabled. Use secure checkout.'}));

r.post('/wallet',async(req,res,next)=>{
  try{
    const credentials=Array.isArray(req.body?.tickets) ? req.body.tickets.slice(0,30) : [];
    const clauses=credentials.filter(item=>item?.reference&&item?.accessToken)
      .map(item=>({reference:String(item.reference),accessToken:String(item.accessToken)}));
    if(!clauses.length) return res.json({tickets:[]});
    const tickets=await Ticket.find({$or:clauses}).select('+accessToken +qrPayload').sort({eventDate:-1});
    res.json({tickets:await Promise.all(tickets.map(publicTicket))});
  }catch(error){ next(error); }
});

export async function stripeWebhook(req,res){
  try{
    const {webhookSecret}=stripeEnv();
    if(!webhookSecret) return res.status(503).send('Stripe webhook is not configured.');
    const stripe=stripeClient();
    const event=stripe.webhooks.constructEvent(req.body,req.get('stripe-signature'),webhookSecret);
    if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){
      const session=event.data.object;
      if(['paid','no_payment_required'].includes(session.payment_status)&&session.metadata?.orderId){
        await fulfill(session.metadata.orderId,session);
      }
      if(session.mode==='subscription'&&session.metadata?.userId&&session.subscription){
        await Membership.findOneAndUpdate({userId:session.metadata.userId},{
          userId:session.metadata.userId,stripeCustomerId:String(session.customer),
          stripeSubscriptionId:String(session.subscription),status:'active'
        },{upsert:true,new:true});
        await User.updateOne({_id:session.metadata.userId},{$set:{stripeCustomerId:String(session.customer)}});
      }
    }
    if(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(event.type)){
      const subscription=event.data.object;
      const user=await User.findOne({stripeCustomerId:String(subscription.customer)}).lean();
      if(user)await Membership.findOneAndUpdate({userId:user._id},{
        userId:user._id,stripeCustomerId:String(subscription.customer),
        stripeSubscriptionId:String(subscription.id),stripePriceId:subscription.items?.data?.[0]?.price?.id||null,
        status:subscription.status,currentPeriodEnd:subscription.current_period_end?new Date(subscription.current_period_end*1000):null,
        cancelAtPeriodEnd:Boolean(subscription.cancel_at_period_end)
      },{upsert:true,new:true});
    }
    if(event.type==='checkout.session.expired'){
      const order=await Order.findOneAndUpdate({stripeSessionId:event.data.object.id,status:'pending'},{$set:{status:'cancelled'}},{new:true});
      if(order)await ArcadeEntry.updateOne({rewardOrderId:order._id,rewardRedeemed:false},{$set:{rewardOrderId:null,rewardReservedAt:null}});
      if(order?.customOrderId){
        const custom=await CustomOrder.findById(order.customOrderId).select('expiresAt').lean();
        await releaseCustomCheckoutVipTables({orderId:order._id,customOrderId:order.customOrderId,expiresAt:custom?.expiresAt||null});
      }else if(order?.tierKey==='booth')await releaseVipTable({orderId:order._id});
      if(order?.customOrderId)await CustomOrder.updateOne({_id:order.customOrderId,reservedOrderId:order._id},{$set:{status:'active',reservedOrderId:null,reservedAt:null},$push:{audit:{action:'checkout_released',details:{reason:'stripe_expired'}}}});
    }
    res.json({received:true});
  }catch(error){
    console.error('Stripe webhook failed:',error.message);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
}

export default r;
