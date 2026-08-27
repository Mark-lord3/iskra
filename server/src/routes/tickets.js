import { randomBytes, randomUUID } from 'node:crypto';
import { Router } from 'express';
import QRCode from 'qrcode';
import Stripe from 'stripe';
import Event from '../models/Event.js';
import Order from '../models/Order.js';
import Player from '../models/Player.js';
import PromoCode from '../models/PromoCode.js';
import Ticket from '../models/Ticket.js';
import Membership from '../models/Membership.js';
import User from '../models/User.js';
import ArcadeEntry from '../models/ArcadeEntry.js';
import { PRIZES } from '../lib/prizes.js';
import {optionalAccount} from '../lib/accountAuth.js';
import {quote as priceQuote, clampQty, tierPrice, tierAvailability, nextUnlock, MAX_QTY} from '../../../shared/pricing.js';
import { deliverTicketEmail } from '../services/ticketEmail.js';

const r = Router();
r.use(optionalAccount);

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
    const qty = clampQty(req.body?.qty);
    const tierKey = TIERS[req.body?.tierKey] ? req.body.tierKey : 'general';
    const event = await Event.findOne({slug:String(req.body?.eventSlug || ''),active:{$ne:false}}).lean();
    if(!event) return res.status(404).json({error:'This event is not available.',code:'NO_EVENT'});

    const raw = String(req.body?.code || '').trim().toUpperCase();
    const promo = raw ? await discountFor(raw,event.slug) : null;
    if(raw && !promo)
      return res.status(200).json({...priceQuote({base:event.from,tierKey,qty}),
        eventSlug:event.slug,eventTitle:event.title,
        codeError:{code:'UNKNOWN_CODE',message:'That code is not valid.'}});

    const priced = priceQuote({base:event.from,tierKey,qty,promo});

    /* What the visitor would need to unlock the next public offer. Reward codes
       stay private: only campaign codes are ever listed here. */
    const now = new Date();
    const campaigns = await PromoCode.find({active:true})
      .select('code label off flat minQty maxQty stackable startsAt expiresAt kind appliesTo').lean();
    const live = campaigns
      .filter(c => (!c.startsAt || c.startsAt <= now) && (!c.expiresAt || c.expiresAt >= now))
      .map(c => ({code:c.code,label:c.label,minQty:c.minQty || 1,
                  percentOff:c.off ? Math.round(c.off*100) : 0,kind:c.kind,status:'live'}));

    res.json({
      ...priced,
      eventSlug:event.slug, eventTitle:event.title, tierKey,
      basePrice:event.from,
      tierAvailability:tierAvailability(event.date,now),
      nextUnlock:nextUnlock(live,qty),
      offers:live,
      maxQty:MAX_QTY,
      serverTime:now
    });
  }catch(e){ next(e); }
});

const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
const CURRENCY = 'cad';
const TIERS = {
  general:{label:'Early bird',price:base=>base},
  early:{label:'Late bird',price:base=>Math.round(base * 1.2)},
  booth:{label:'VIP table',price:base=>Math.round(base * 8)}
};
const deliverEmailSafely=async orderId=>{
  try{ return await deliverTicketEmail(orderId); }
  catch(error){
    console.error(`Ticket email delivery crashed for order ${orderId}:`,error.message);
    return {sent:false,status:'failed'};
  }
};

const stripeClient = () => {
  if(!process.env.STRIPE_SECRET_KEY){
    const error = new Error('Stripe is not configured. Add STRIPE_SECRET_KEY to server/.env.');
    error.status = 503;
    throw error;
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

const publicTicket = async ticket => ({
  id:ticket._id,reference:ticket.reference,eventSlug:ticket.eventSlug,
  eventTitle:ticket.eventTitle,eventDate:ticket.eventDate,room:ticket.room,
  buyerName:ticket.buyerName,tier:ticket.tier,price:ticket.price,
  status:ticket.status,redeemedAt:ticket.redeemedAt,
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
  const qty = clampQty(body.qty);
  if(buyerName.length < 2) throw Object.assign(new Error('Enter the ticket holder name.'),{status:400});
  if(!EMAIL.test(buyerEmail)) throw Object.assign(new Error('Enter a valid email address.'),{status:400});

  const event = await Event.findOne({slug:body.eventSlug,active:{$ne:false}}).lean();
  if(!event) throw Object.assign(new Error('This event is not available.'),{status:404});

  const issued = await Ticket.countDocuments({eventSlug:event.slug,status:{$ne:'cancelled'}});
  const held = await Order.aggregate([
    {$match:{eventSlug:event.slug,status:'pending',createdAt:{$gte:new Date(Date.now()-31*60_000)}}},
    {$group:{_id:null,qty:{$sum:'$qty'}}}
  ]);
  const remaining = event.capacity > 0 ? event.capacity - issued - (held[0]?.qty || 0) : Infinity;
  if(remaining < qty) throw Object.assign(new Error(`Only ${Math.max(0,remaining)} ticket(s) remain.`),{status:409});

  const tierKey = TIERS[body.tierKey] ? body.tierKey : 'general';
  const tier = TIERS[tierKey];
  const availability = tierAvailability(event.date,new Date());
  if(!availability[tierKey]){
    const message = tierKey === 'general'
      ? 'Early bird sales have ended. Choose Late bird.'
      : 'Late bird tickets become available on the event date.';
    throw Object.assign(new Error(message),{status:409,code:'TIER_NOT_AVAILABLE'});
  }
  const discount = await discountFor(body.code,event.slug);
  if(body.code && !discount) throw Object.assign(new Error('That promo code is no longer valid.'),{status:400});

  /* One shared calculation for the calculator and for the charge, so a price
     shown on the offers page is the price actually taken. */
  const priced = priceQuote({base:event.from,tierKey,qty,promo:discount});

  // A code the visitor asked for but which does not apply is refused loudly
  // rather than silently dropped from the total.
  if(discount && !priced.promo.applied){
    const reason = priced.promo.reason;
    const message = reason === 'MIN_QTY'
      ? `${discount.code} needs ${priced.promo.minQty} tickets. Add ${priced.promo.need} more ticket${priced.promo.need === 1 ? '' : 's'}.`
      : reason === 'EXPIRED' ? 'That promo code has expired.'
      : reason === 'NOT_STARTED' ? 'That promo code is not active yet.'
      : 'That promo code does not apply to this event.';
    throw Object.assign(new Error(message),{status:400,code:'PROMO_NOT_APPLICABLE'});
  }

  return {event,buyerName,buyerEmail,qty,tierKey,tier,
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
    const docs = Array.from({length:claimed.qty},()=>{
      const reference = `ISKRA-${randomUUID().replaceAll('-','').slice(0,12).toUpperCase()}`;
      const accessToken = randomBytes(24).toString('hex');
      const qrSecret = randomBytes(18).toString('base64url');
      return {
        reference,accessToken,qrSecret,qrPayload:`ISKRA:${reference}:${qrSecret}`,
        eventSlug:event.slug,eventTitle:event.title,eventDate:event.date,room:event.room,
        buyerName:claimed.buyerName,buyerEmail:claimed.email,tier:claimed.tier,
        price:claimed.total/claimed.qty,orderId:claimed._id,userId:claimed.userId,
        stripeSessionId:claimed.stripeSessionId
      };
    });
    await Ticket.create(docs);
    await Order.updateOne({_id:claimed._id},{$set:{status:'paid',paymentStatus:session?.payment_status || 'paid'}});
    if(claimed.code){
      await Promise.all([
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
  try{
    const priced = await pricedOrder(req.body || {});
    order = await Order.create({
      eventSlug:priced.event.slug,tier:priced.tier.label,tierKey:priced.tierKey,qty:priced.qty,
      subtotal:priced.subtotal,total:priced.total,code:priced.discount?.code || null,
      playerId:req.body.playerId || null,userId:req.account?._id || null,
      email:priced.buyerEmail,buyerName:priced.buyerName,
      locale:['en','uk','ru'].includes(req.body.locale) ? req.body.locale : 'en',
      currency:CURRENCY,status:'pending',paymentStatus:priced.total === 0 ? 'no_payment_required' : 'unpaid'
    });
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
    const session = await stripeClient().checkout.sessions.create({
      mode:'payment',customer_email:priced.buyerEmail,client_reference_id:String(order._id),
      line_items:[{quantity:1,price_data:{currency:CURRENCY,unit_amount:Math.round(priced.total*100),
        product_data:{name:priced.event.title,description:`${priced.qty} x ${priced.tier.label}`}}}],
      metadata:{orderId:String(order._id),eventSlug:priced.event.slug,quantity:String(priced.qty)},
      payment_intent_data:{receipt_email:priced.buyerEmail,metadata:{orderId:String(order._id)}},
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
    if(!process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).send('Stripe webhook is not configured.');
    const stripe=stripeClient();
    const event=stripe.webhooks.constructEvent(req.body,req.get('stripe-signature'),process.env.STRIPE_WEBHOOK_SECRET);
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
    }
    res.json({received:true});
  }catch(error){
    console.error('Stripe webhook failed:',error.message);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
}

export default r;
