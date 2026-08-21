import { Router } from 'express';
import crypto from 'node:crypto';
import Player from '../models/Player.js';
import { attemptsLeft } from '../lib/attempts.js';

const r = Router();
const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

// Sign up (or sign back in with the same email) to enter the leaderboard.
r.post('/', async (req,res,next)=>{
  try{
    const handle = String(req.body.handle||'').trim().slice(0,18);
    const email   = String(req.body.email||'').trim().toLowerCase();
    const consent = !!req.body.consent;

    if(handle.length < 2)   return res.status(400).json({error:'Give us a name with at least 2 characters.'});
    if(!EMAIL.test(email))  return res.status(400).json({error:'That email does not look right.'});
    if(!consent)            return res.status(400).json({error:'Tick the box so we can send your prize code.'});

    let player = await Player.findOne({email}).select('+token');
    if(player){
      // returning player — refresh the display name, hand back the same identity
      if(player.handle !== handle){ player.handle = handle; await player.save(); }
    } else {
      player = await Player.create({ handle, email, consent, token: crypto.randomBytes(24).toString('hex') });
    }
    res.status(201).json({
      id:player.id, handle:player.handle, token:player.token,
      bestScore:player.bestScore, attemptsLeft:attemptsLeft(player),
      reward:player.rewardCode?{code:player.rewardCode,tier:player.rewardTier}:null
    });
  }catch(e){
    if(e?.code === 11000) return res.status(409).json({error:'That email is already on the board.'});
    next(e);
  }
});

// Current status for a known player (attempts left, best score, prize code).
r.get('/:id', async (req,res,next)=>{
  try{
    const p = await Player.findById(req.params.id);
    if(!p) return res.status(404).json({error:'Player not found'});
    res.json({
      id:p.id, handle:p.handle, bestScore:p.bestScore, attemptsLeft:attemptsLeft(p),
      reward:p.rewardCode?{code:p.rewardCode,tier:p.rewardTier}:null
    });
  }catch(e){ next(e); }
});

export default r;
