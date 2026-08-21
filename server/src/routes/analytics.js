import { Router } from 'express';
import AnalyticsEvent from '../models/AnalyticsEvent.js';

const r = Router();

r.post('/', async (req,res,next)=>{
  try{
    const type = ['visit','click','signup'].includes(req.body.type) ? req.body.type : 'click';
    await AnalyticsEvent.create({
      type,
      path:String(req.body.path || '/').slice(0,180),
      label:String(req.body.label || '').slice(0,160),
      referrer:String(req.body.referrer || req.get('referer') || '').slice(0,240),
      userAgent:String(req.get('user-agent') || '').slice(0,260),
      ip:req.ip
    });
    res.status(201).json({ok:true});
  }catch(e){ next(e); }
});

export default r;

