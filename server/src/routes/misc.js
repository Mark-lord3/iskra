import { Router } from 'express';
import Subscriber from '../models/Subscriber.js';
import Order from '../models/Order.js';
import AnalyticsEvent from '../models/AnalyticsEvent.js';

const r = Router();
const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

r.post('/subscribe', async (req,res,next)=>{
  try{
    const email = String(req.body.email||'').trim().toLowerCase();
    if(!EMAIL.test(email)) return res.status(400).json({error:'That email does not look right.'});
    await Subscriber.updateOne({email},{$setOnInsert:{email}},{upsert:true});
    await AnalyticsEvent.create({
      type:'signup',
      path:req.body.path || '/newsletter',
      label:'newsletter',
      referrer:req.get('referer') || '',
      userAgent:req.get('user-agent') || '',
      ip:req.ip
    });
    res.status(201).json({ok:true});
  }catch(e){ next(e); }
});

// Demo checkout — records the intent, takes no payment.
r.post('/orders', async (req,res,next)=>{
  try{
    const { eventSlug, tier, qty, subtotal, total, code = null, playerId = null } = req.body || {};
    if(!eventSlug || !tier || !qty) return res.status(400).json({error:'Missing order details.'});
    const order = await Order.create({
      eventSlug, tier, qty:Math.min(10,Math.max(1,Number(qty))),
      subtotal:Number(subtotal)||0, total:Number(total)||0, code,
      playerId: playerId || null
    });
    res.status(201).json({ ok:true, orderId:order.id, status:'demo' });
  }catch(e){ next(e); }
});

export default r;
