import { Router } from 'express';
import ContactMessage from '../models/ContactMessage.js';
import AnalyticsEvent from '../models/AnalyticsEvent.js';

const r = Router();
const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

r.post('/', async (req,res,next)=>{
  try{
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const subject = String(req.body.subject || 'General').trim();
    const message = String(req.body.message || '').trim();

    if(name.length < 2) return res.status(400).json({error:'Please enter your name.'});
    if(!EMAIL.test(email)) return res.status(400).json({error:'That email does not look right.'});
    if(message.length < 8) return res.status(400).json({error:'Please write a little more.'});

    await ContactMessage.create({ name, email, subject, message });
    await AnalyticsEvent.create({
      type:'contact',
      path:req.body.path || '/contact',
      label:subject,
      referrer:req.get('referer') || '',
      userAgent:req.get('user-agent') || '',
      ip:req.ip
    });
    res.status(201).json({ok:true});
  }catch(e){ next(e); }
});

export default r;

