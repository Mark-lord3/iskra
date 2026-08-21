import { Router } from 'express';
import PromoCode from '../models/PromoCode.js';
import Player from '../models/Player.js';
import { PRIZES } from '../lib/prizes.js';

const r = Router();

// Validates both the public campaign codes and the unique codes won in Spark Rush.
r.post('/validate', async (req,res,next)=>{
  try{
    const code = String(req.body.code||'').trim().toUpperCase();
    if(!code) return res.status(400).json({valid:false,error:'Enter a code.'});

    const promo = await PromoCode.findOne({ code, active:true });
    if(promo){
      if(promo.expiresAt && promo.expiresAt < new Date())
        return res.json({valid:false,error:'That code has expired.'});
      return res.json({valid:true, code, off:promo.off, flat:promo.flat,
                       maxQty:promo.maxQty, label:promo.label});
    }

    const player = await Player.findOne({ rewardCode: code });
    if(player){
      if(player.rewardRedeemed) return res.json({valid:false,error:'That code has already been used.'});
      const prize = PRIZES[player.rewardTier] || PRIZES.played;
      return res.json({valid:true, code, off:prize.off||0, flat:prize.flat||0,
                       maxQty:prize.maxQty, label:prize.label});
    }
    res.json({ valid:false, error:'That code is not valid.' });
  }catch(e){ next(e); }
});

export default r;
