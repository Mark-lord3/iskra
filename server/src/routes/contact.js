import { Router } from 'express';
import ContactMessage from '../models/ContactMessage.js';
import AnalyticsEvent from '../models/AnalyticsEvent.js';

const r = Router();
const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
const CATEGORIES = ['general','birthday','table','booking','venue','brand','press'];

/* Errors name the field they belong to so the form can describe them to a
   screen reader on the right input rather than in a detached banner. */
const fail = (res, status, field, code) => res.status(status).json({ field, code, error:code });

r.post('/', async (req,res,next)=>{
  try{
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const subject = String(req.body.subject || 'General').trim().slice(0,120);
    const message = String(req.body.message || '').trim();
    const category = CATEGORIES.includes(req.body.category) ? req.body.category : 'general';

    if(name.length < 2)     return fail(res,400,'name','NAME');
    if(!EMAIL.test(email))  return fail(res,400,'email','EMAIL');
    if(message.length < 8)  return fail(res,400,'message','MESSAGE');

    let eventDate = null;
    if(req.body.eventDate){
      const d = new Date(req.body.eventDate);
      if(Number.isNaN(d.getTime())) return fail(res,400,'eventDate','DATE');
      eventDate = d;
    }
    let groupSize = null;
    if(req.body.groupSize !== '' && req.body.groupSize != null){
      const n = Number(req.body.groupSize);
      if(!Number.isInteger(n) || n < 1 || n > 500) return fail(res,400,'groupSize','GROUP');
      groupSize = n;
    }

    await ContactMessage.create({ name, email, subject, message, category, eventDate, groupSize });
    await AnalyticsEvent.create({
      type:'contact', path:req.body.path || '/contact', label:category,
      referrer:req.get('referer') || '', userAgent:req.get('user-agent') || '', ip:req.ip
    });
    res.status(201).json({ ok:true });
  }catch(e){ next(e); }
});

export default r;
