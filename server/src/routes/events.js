import { Router } from 'express';
import Event from '../models/Event.js';

const r = Router();

r.get('/', async (_req,res,next)=>{
  try{
    const events = await Event.find({}).sort({date:1}).lean();
    res.json(events.map(e=>({
      id:e.slug, date:e.date, title:e.title, support:e.support, room:e.room,
      tags:e.tags, badges:e.badges, from:e.from, was:e.was, sold:e.sold
    })));
  }catch(e){ next(e); }
});

export default r;
