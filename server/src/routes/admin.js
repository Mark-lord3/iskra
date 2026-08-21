import { Router } from 'express';
import AnalyticsEvent from '../models/AnalyticsEvent.js';
import Banner from '../models/Banner.js';
import ContactMessage from '../models/ContactMessage.js';
import Event from '../models/Event.js';
import Order from '../models/Order.js';
import Subscriber from '../models/Subscriber.js';

const r = Router();

function requireAdmin(req,res,next){
  const configured = process.env.ADMIN_KEY || 'iskra-local-admin';
  const provided = req.get('x-admin-key') || req.query.key;
  if(provided !== configured) return res.status(401).json({error:'Admin key required.'});
  next();
}

const cleanEvent = e => ({
  id:e.slug, slug:e.slug, date:e.date, title:e.title, support:e.support, room:e.room,
  tags:e.tags, badges:e.badges, from:e.from, was:e.was, sold:e.sold
});

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
    const [subscribers, messages, orders, visits, clicks, signups, events, banners, recentMessages] = await Promise.all([
      Subscriber.countDocuments(),
      ContactMessage.countDocuments(),
      Order.countDocuments(),
      AnalyticsEvent.countDocuments({type:'visit'}),
      AnalyticsEvent.countDocuments({type:'click'}),
      AnalyticsEvent.countDocuments({type:'signup'}),
      Event.find({}).sort({date:-1}).lean(),
      Banner.find({}).sort({updatedAt:-1}).lean(),
      ContactMessage.find({}).sort({createdAt:-1}).limit(25).lean()
    ]);
    const subscribersList = await Subscriber.find({}).sort({createdAt:-1}).limit(200).lean();

    res.json({
      totals:{ subscribers, messages, orders, visits, clicks, signups },
      events:events.map(cleanEvent),
      banners,
      messages:recentMessages,
      subscribers:subscribersList
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
        tags:String(req.body.tags || '').split(',').map(s=>s.trim()).filter(Boolean),
        badges:String(req.body.badges || '').split(',').map(s=>s.trim()).filter(Boolean),
        from:Number(req.body.from) || 0,
        was:Number(req.body.was) || 0,
        sold:Math.min(100, Math.max(0, Number(req.body.sold) || 0))
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

export default r;

