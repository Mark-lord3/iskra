import { Router } from 'express';
import crypto from 'node:crypto';
import Player from '../models/Player.js';
import { attemptsLeft } from '../lib/attempts.js';
import { validateDisplayName } from '../../../shared/displayName.js';
import { optionalAccount, requireAccount, requireCsrf } from '../lib/accountAuth.js';
import {currentContest,contestPublic,entryFor} from '../lib/arcadeContest.js';
import {PRIZES} from '../lib/prizes.js';

const r = Router();
r.use(optionalAccount);
const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
const tokenMatches=(supplied,expected)=>{
  const a=Buffer.from(String(supplied||'')),b=Buffer.from(String(expected||''));
  return a.length===b.length&&a.length>0&&crypto.timingSafeEqual(a,b);
};

/* The client turns these codes into localised copy. The message never says
   which word was rejected, so the filter cannot be probed by trial and error. */
const NAME_ERROR = {
  length:  { code:'NAME_LENGTH',  error:'Use 3 to 18 characters.' },
  letters: { code:'NAME_LETTERS', error:'Use at least one letter.' },
  blocked: { code:'NAME_BLOCKED', error:'Choose another display name.' }
};

/** Everything the browser is allowed to know about a player. Never the token,
 *  never the email. */
const publicPlayer = async (p, extra = {}) => {
  const contest=await currentContest();
  const entry=await entryFor(contest,p,{create:Boolean(contest&&contest.status==='open')});
  const prize=entry?.rewardTier?PRIZES[entry.rewardTier]:null;
  return {
    id:p.id,handle:p.handle,bestScore:entry?.bestScore||0,bestAt:entry?.bestAt||null,
    attemptsLeft:contest?.status==='open'?(entry?attemptsLeft(entry):3):0,
    reward:entry?.rewardCode?{code:entry.rewardCode,tier:entry.rewardTier,head:prize?.head,sub:prize?.sub,eventSlug:entry.eventSlug}:null,
    contest:contestPublic(contest),...extra
  };
};

/**
 * A signed-in ISKRA member already supplied their identity at registration.
 * Link that account to the arcade record without asking for the same name and
 * email again. The score token is returned only to the authenticated account.
 */
r.post('/account', requireAccount, requireCsrf, async (req,res,next)=>{
  try{
    const preferred = String(req.account.name || '').trim().slice(0,18);
    const checked = validateDisplayName(preferred);
    const handle = checked.ok ? checked.handle : `ISKRA-${String(req.account._id).slice(-6).toUpperCase()}`;
    let player = await Player.findOne({ email:req.account.email }).select('+token');
    if(player){
      if(player.handle !== handle){ player.handle=handle; await player.save(); }
    }else{
      player=await Player.create({
        handle,email:req.account.email,
        consent:Boolean(req.account.preferences?.newsletter),
        token:crypto.randomBytes(24).toString('hex')
      });
    }
    res.status(201).json(await publicPlayer(player,{token:player.token,accountLinked:true}));
  }catch(error){next(error);}
});

// Sign up, or sign back in with the same email.
r.post('/', async (req,res,next)=>{
  try{
    const check = validateDisplayName(req.body.handle);
    if(!check.ok) return res.status(400).json(NAME_ERROR[check.reason]);
    const handle = check.handle;

    const email   = String(req.body.email||'').trim().toLowerCase();
    const consent = !!req.body.consent;
    if(!EMAIL.test(email)) return res.status(400).json({error:'That email does not look right.',code:'EMAIL'});
    if(!consent)           return res.status(400).json({error:'Consent is required.',code:'CONSENT'});

    let player = await Player.findOne({email}).select('+token');
    if(player){
      return res.status(409).json({
        error:'This email already has a player. Sign in to your Project ISKRA account or continue on the original device.',
        code:'PLAYER_EXISTS'
      });
    } else {
      player = await Player.create({ handle, email, consent, token: crypto.randomBytes(24).toString('hex') });
    }
    // The token is issued once, here, and is the only thing that authorises a
    // score submission for this player.
    res.status(201).json(await publicPlayer(player, { token: player.token }));
  }catch(e){
    if(e?.code === 11000) return res.status(409).json({error:'That email is already on the board.',code:'DUPLICATE'});
    next(e);
  }
});

// Live status for a known player: attempts left, best score, prize code.
r.get('/:id', async (req,res,next)=>{
  try{
    const p = await Player.findById(req.params.id).select('+token');
    if(!p) return res.status(404).json({error:'Player not found',code:'NOT_FOUND'});
    const ownsAccount=req.account&&req.account.email===p.email;
    if(!ownsAccount&&!tokenMatches(req.get('x-player-token'),p.token))
      return res.status(401).json({error:'Player session required.',code:'AUTH'});
    res.json(await publicPlayer(p));
  }catch(e){ next(e); }
});

// Name pre-check for the sign-up form, so the player sees the problem before
// committing an email address.
r.post('/check-name', (req,res)=>{
  const check = validateDisplayName(req.body.handle);
  if(check.ok) return res.json({ ok:true });
  res.status(400).json({ ok:false, ...NAME_ERROR[check.reason] });
});

export default r;
