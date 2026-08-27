import { Router } from 'express';
import Subscriber from '../models/Subscriber.js';
import AnalyticsEvent from '../models/AnalyticsEvent.js';

const r = Router();
const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

r.post('/subscribe', async (req,res,next)=>{
  try{
    const email = String(req.body.email||'').trim().toLowerCase();
    if(!EMAIL.test(email)) return res.status(400).json({error:'That email does not look right.',code:'EMAIL'});
    // upsertedCount tells us whether this address was already on the list, so
    // the page can say "already subscribed" instead of a generic success.
    const result = await Subscriber.updateOne({email},{$setOnInsert:{email,source:req.body.source||'newsletter'}},{upsert:true});
    const duplicate = !result.upsertedCount;
    await AnalyticsEvent.create({
      type:'signup',
      path:req.body.path || '/newsletter',
      label:duplicate ? 'newsletter-duplicate' : 'newsletter',
      referrer:req.get('referer') || '',
      userAgent:req.get('user-agent') || '',
      ip:req.ip
    });
    res.status(201).json({ok:true, duplicate});
  }catch(e){ next(e); }
});

r.post('/orders', (_req,res)=>res.status(410).json({error:'Demo checkout is disabled. Use /api/tickets/checkout.'}));

export default r;
