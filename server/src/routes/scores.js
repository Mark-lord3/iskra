import { Router } from 'express';
import Player from '../models/Player.js';
import { attemptsLeft, useAttempt } from '../lib/attempts.js';
import { rankOf } from '../lib/rank.js';
import { prizeForRank, isUpgrade, claimCode } from '../lib/prizes.js';

const r = Router();

// Sanity bounds. A near-perfect 60s round lands around 65k; anything far past
// that did not come from the game.
const MAX_SCORE = 150000;
const MIN_MS = 50000, MAX_MS = 75000;

r.post('/', async (req,res,next)=>{
  try{
    const { playerId, token, score, hits = 0, bestMult = 1, durationMs = 60000 } = req.body || {};
    if(!playerId || !token) return res.status(401).json({error:'Sign up before submitting a score.'});

    const player = await Player.findById(playerId).select('+token');
    if(!player)                 return res.status(404).json({error:'Player not found'});
    if(player.token !== token)  return res.status(401).json({error:'Invalid session token.'});

    const s = Number(score);
    if(!Number.isInteger(s) || s < 0 || s > MAX_SCORE)
      return res.status(400).json({error:'That score is not valid.'});
    if(durationMs < MIN_MS || durationMs > MAX_MS)
      return res.status(400).json({error:'That round length is not valid.'});
    if(attemptsLeft(player) <= 0)
      return res.status(429).json({error:'No attempts left today. The board resets at midnight.'});

    useAttempt(player);
    player.plays.push({ score:s, hits:Number(hits)||0, bestMult:Number(bestMult)||1 });
    if(player.plays.length > 50) player.plays = player.plays.slice(-50);
    if(s > player.bestScore){ player.bestScore = s; player.bestAt = new Date(); }
    await player.save();

    const rank  = await rankOf(player);
    const prize = prizeForRank(rank);
    if(isUpgrade(prize.tier, player.rewardTier)){
      player.rewardTier = prize.tier;
      player.rewardCode = claimCode(prize.tier);
      await player.save();
    }

    res.status(201).json({
      score:s, rank, bestScore:player.bestScore, attemptsLeft:attemptsLeft(player),
      reward:{ code:player.rewardCode, tier:player.rewardTier,
               head:prize.head, sub:prize.sub, label:prize.label }
    });
  }catch(e){ next(e); }
});

export default r;
