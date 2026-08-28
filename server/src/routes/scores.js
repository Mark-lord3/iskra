import { Router } from 'express';
import Player from '../models/Player.js';
import { attemptsLeft, useAttempt } from '../lib/attempts.js';
import ArcadeEntry from '../models/ArcadeEntry.js';
import {currentContest,contestPublic,entryFor} from '../lib/arcadeContest.js';
import crypto from 'node:crypto';

const r = Router();

/* Anti-cheat envelope. A round is a fixed 60 seconds and the best possible hit
   is worth 250 base x 1.5 accuracy x 5 multiplier, so score, hit count and
   duration have to agree with each other for a submission to be plausible. */
export const ROUND_SECONDS = 60;
export const MAX_SCORE      = 150000;
export const MIN_MS         = 50000;
export const MAX_MS         = 75000;
export const MAX_PER_HIT    = 1875;
export const MAX_HITS       = 240;
export const MIN_GAP_MS     = 45000;   // two rounds cannot overlap in time

/**
 * Pure validation, exported so it can be unit tested without a database.
 * @returns {{ok:true}|{ok:false,status:number,code:string,error:string}}
 */
export function validateSubmission({ score, hits, bestMult, durationMs }, { lastPlayAt, now = Date.now() } = {}) {
  const s = Number(score), h = Number(hits), m = Number(bestMult), d = Number(durationMs);

  if(!Number.isInteger(s) || s < 0 || s > MAX_SCORE)
    return { ok:false, status:400, code:'SCORE_RANGE', error:'That score is not valid.' };
  if(!Number.isInteger(h) || h < 0 || h > MAX_HITS)
    return { ok:false, status:400, code:'HITS_RANGE', error:'That hit count is not valid.' };
  if(!Number.isFinite(m) || m < 1 || m > 5)
    return { ok:false, status:400, code:'MULT_RANGE', error:'That multiplier is not valid.' };
  if(!Number.isFinite(d) || d < MIN_MS || d > MAX_MS)
    return { ok:false, status:400, code:'DURATION', error:'That round length is not valid.' };
  // Points have to be earned by hits: no hits means no score, and no hit can be
  // worth more than the best possible target.
  if(s > h * MAX_PER_HIT)
    return { ok:false, status:400, code:'SCORE_HITS', error:'That score does not match the round.' };
  if(lastPlayAt && now - new Date(lastPlayAt).getTime() < MIN_GAP_MS)
    return { ok:false, status:429, code:'TOO_FAST', error:'That round finished too soon after the last one.' };

  return { ok:true };
}

r.post('/', async (req,res,next)=>{
  try{
    const { playerId, token, roundId, score, hits = 0, bestMult = 1, durationMs = 60000 } = req.body || {};
    if(!playerId || !token) return res.status(401).json({error:'Sign up before submitting a score.',code:'AUTH'});
    if(!roundId || typeof roundId !== 'string' || roundId.length > 64)
      return res.status(400).json({error:'Missing round id.',code:'ROUND_ID'});

    const player = await Player.findById(playerId).select('+token');
    if(!player)                return res.status(404).json({error:'Player not found',code:'NOT_FOUND'});
    const supplied=Buffer.from(String(token)),expected=Buffer.from(String(player.token));
    if(supplied.length!==expected.length||!supplied.length||!crypto.timingSafeEqual(supplied,expected))
      return res.status(401).json({error:'Invalid session token.',code:'AUTH'});

    const contest=await currentContest();
    if(!contest||contest.status!=='open')
      return res.status(409).json({error:'This event competition is closed.',code:'CONTEST_CLOSED',contest:contestPublic(contest)});
    const entry=await entryFor(contest,player,{create:true});

    // Replay protection: the same finished round can only ever count once.
    if(entry.plays.some(p => p.roundId && p.roundId === roundId))
      return res.status(409).json({error:'That round was already submitted.',code:'DUPLICATE_ROUND'});

    const last = entry.plays.length ? entry.plays[entry.plays.length-1].at : null;
    const check = validateSubmission({ score, hits, bestMult, durationMs }, { lastPlayAt:last });
    if(!check.ok) return res.status(check.status).json({error:check.error,code:check.code});

    if(attemptsLeft(entry) <= 0)
      return res.status(409).json({error:'No attempts left today. The board resets at midnight.',code:'NO_ATTEMPTS'});

    const s = Number(score);
    useAttempt(entry);
    entry.plays.push({score:s,hits:Number(hits)||0,bestMult:Number(bestMult)||1,roundId});
    if(entry.plays.length>50)entry.plays=entry.plays.slice(-50);
    // Ties are broken by who reached the score first, so bestAt only moves on a
    // genuine improvement.
    if(s>entry.bestScore){entry.bestScore=s;entry.bestAt=new Date();}
    await entry.save();

    const higher=await ArcadeEntry.countDocuments({contest:contest._id,$or:[
      {bestScore:{$gt:entry.bestScore}},
      {bestScore:entry.bestScore,bestAt:{$lt:entry.bestAt}}
    ]});
    const rank=higher+1;

    res.status(201).json({
      score:s,rank,bestScore:entry.bestScore,bestAt:entry.bestAt,
      attemptsLeft:attemptsLeft(entry),contest:contestPublic(contest),
      reward:{pending:true,head:'Provisional ranking',sub:'Rewards are finalized and emailed after the countdown closes.'}
    });
  }catch(e){ next(e); }
});

export default r;
