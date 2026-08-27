import { Router } from 'express';
import PromoCode from '../models/PromoCode.js';
import Player from '../models/Player.js';
import { PRIZES } from '../lib/prizes.js';
import ArcadeEntry from '../models/ArcadeEntry.js';

const r = Router();

// Validates both the public campaign codes and the unique codes won in Spark Rush.
r.post('/validate', async (req,res,next)=>{
  try{
    const code = String(req.body.code||'').trim().toUpperCase();
    if(!code) return res.status(400).json({valid:false,error:'Enter a code.'});

    const promo = await PromoCode.findOne({ code, active:true });
    if(promo){
      const now = new Date();
      if(promo.expiresAt && promo.expiresAt < now)
        return res.json({valid:false,error:'That code has expired.',reason:'EXPIRED'});
      if(promo.startsAt && promo.startsAt > now)
        return res.json({valid:false,error:'That code is not active yet.',reason:'NOT_STARTED'});

      /* The minimum travels with the code, so the checkout can say how many
         more tickets are needed instead of just refusing. */
      const qty = Number(req.body.qty) || 0;
      const minQty = promo.minQty || 1;
      if(qty > 0 && qty < minQty)
        return res.json({valid:false, reason:'MIN_QTY', code, minQty, need:minQty - qty,
          off:promo.off, flat:promo.flat, maxQty:promo.maxQty,
          stackable:promo.stackable !== false, kind:promo.kind, label:promo.label,
          error:`${code} needs ${minQty} tickets. Add ${minQty - qty} more ticket${minQty - qty === 1 ? '' : 's'}.`});

      return res.json({valid:true, code, off:promo.off, flat:promo.flat,
                       minQty, maxQty:promo.maxQty, stackable:promo.stackable !== false,
                       kind:promo.kind, label:promo.label});
    }

    const eventSlug=String(req.body.eventSlug||'').trim();
    const entry=await ArcadeEntry.findOne({rewardCode:code}).populate('contest');
    if(entry){
      if(entry.rewardRedeemed)return res.json({valid:false,error:'That code has already been used.'});
      if(entry.contest?.status!=='finalized'||new Date(entry.contest.eventDate)<=new Date())
        return res.json({valid:false,error:'That event reward is not active.',reason:'EXPIRED'});
      if(eventSlug&&entry.eventSlug!==eventSlug)return res.json({valid:false,error:'That reward belongs to a different event.',reason:'WRONG_EVENT'});
      const prize=PRIZES[entry.rewardTier]||PRIZES.played;
      return res.json({valid:true, code, off:prize.off||0, flat:prize.flat||0,
                       minQty:1,maxQty:prize.maxQty,stackable:false,label:prize.label,eventSlug:entry.eventSlug});
    }
    const player = await Player.findOne({ rewardCode: code });
    if(player){
      if(player.rewardRedeemed) return res.json({valid:false,error:'That code has already been used.'});
      const prize = PRIZES[player.rewardTier] || PRIZES.played;
      return res.json({valid:true,code,off:prize.off||0,flat:prize.flat||0,minQty:1,maxQty:prize.maxQty,stackable:false,label:prize.label});
    }
    res.json({ valid:false, error:'That code is not valid.' });
  }catch(e){ next(e); }
});

/**
 * Public campaign listing for the offers page.
 *
 * Reads the PromoCode collection only. Player reward codes are stored on the
 * Player document and are deliberately unreachable from here, so a unique code
 * earned in Spark Rush can never be enumerated by a visitor.
 */
r.get('/public', async (_req,res,next)=>{
  try{
    const now = new Date();
    const rows = await PromoCode.find({ active:true })
      .select('code label off flat minQty maxQty stackable startsAt expiresAt kind appliesTo text')
      .sort({ off:-1 })
      .lean();

    const campaigns = rows.map(c => {
      const status = c.startsAt && c.startsAt > now ? 'scheduled'
                   : c.expiresAt && c.expiresAt < now ? 'expired'
                   : 'live';
      return {
        code: c.code,
        label: c.label,
        kind: c.kind || 'early',
        percentOff: c.off ? Math.round(c.off * 100) : 0,
        flatPrice: c.flat || 0,
        minQty: c.minQty || 1,
        maxQty: c.maxQty,
        stackable: c.stackable !== false,
        text: c.text || null,
        startsAt: c.startsAt,
        expiresAt: c.expiresAt,
        appliesTo: c.appliesTo || 'all',
        status
      };
    });

    res.json({ campaigns, serverTime: now });
  }catch(e){ next(e); }
});

export default r;
