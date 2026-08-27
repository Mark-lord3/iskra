import {Router} from 'express';
import EventFeedback from '../models/EventFeedback.js';
import Ticket from '../models/Ticket.js';

const r = Router();
const score = value=>{
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
};

r.post('/',async (req,res,next)=>{
  try{
    const reference = String(req.body.reference || '').trim().toUpperCase();
    const accessToken = String(req.body.accessToken || '');
    const ticket = await Ticket.findOne({reference,accessToken}).select('+accessToken');
    if(!ticket) return res.status(403).json({error:'Ticket access could not be verified.'});
    if(new Date(ticket.eventDate) > new Date() && ticket.status !== 'redeemed') {
      return res.status(409).json({error:'Feedback opens after the event or check-in.'});
    }
    const rating = score(req.body.rating);
    const music = score(req.body.music);
    const venue = score(req.body.venue);
    if(!rating || !music || !venue) return res.status(400).json({error:'Choose a score for each category.'});
    const feedback = await EventFeedback.findOneAndUpdate(
      {ticketReference:ticket.reference},
      {ticketReference:ticket.reference,eventSlug:ticket.eventSlug,eventTitle:ticket.eventTitle,
        rating,music,venue,comment:String(req.body.comment || '').trim().slice(0,800)},
      {upsert:true,new:true,runValidators:true}
    );
    res.status(201).json({ok:true,id:feedback._id});
  }catch(e){ next(e); }
});

export default r;
