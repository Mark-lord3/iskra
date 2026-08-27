import { Router } from 'express';
import Event from '../models/Event.js';
import Ticket from '../models/Ticket.js';

const r = Router();

r.get('/', async (_req,res,next)=>{
  try{
    const events = await Event.find({active:{$ne:false}}).sort({date:1}).lean();
    const counts = await Ticket.aggregate([
      {$match:{status:{$ne:'cancelled'}}},
      {$group:{_id:'$eventSlug',count:{$sum:1}}}
    ]);
    const countBySlug = new Map(counts.map(item=>[item._id,item.count]));
    res.json(events.map(e=>{
      const reserved = countBySlug.get(e.slug) || 0;
      const sold = e.capacity > 0 ? Math.min(100,Math.round(reserved/e.capacity*100)) : e.sold;
      return {
        id:e.slug,slug:e.slug,date:e.date,title:e.title,support:e.support,room:e.room,
        address:e.address,description:e.description,image:e.image,tags:e.tags,badges:e.badges,
        from:e.from,was:e.was,sold,capacity:e.capacity,reserved,
        available:e.capacity > 0 ? Math.max(0,e.capacity-reserved) : null
      };
    }));
  }catch(e){ next(e); }
});

export default r;
