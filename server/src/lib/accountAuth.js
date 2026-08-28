import crypto from 'node:crypto';
import {promisify} from 'node:util';
import {parseCookie as parseCookies} from 'cookie';
import User from '../models/User.js';
import UserSession from '../models/UserSession.js';

const scrypt=promisify(crypto.scrypt);
const COOKIE='iskra_session';
const SESSION_DAYS=30;
export const hashToken=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
export const randomToken=(bytes=32)=>crypto.randomBytes(bytes).toString('base64url');

export async function hashPassword(password){
  const salt=crypto.randomBytes(16).toString('hex');
  const derived=await scrypt(password,salt,64);
  return `scrypt:${salt}:${Buffer.from(derived).toString('hex')}`;
}
export async function verifyPassword(password,encoded){
  const [kind,salt,hex]=String(encoded||'').split(':');
  if(kind!=='scrypt'||!salt||!hex)return false;
  const derived=Buffer.from(await scrypt(password,salt,64));
  const expected=Buffer.from(hex,'hex');
  return derived.length===expected.length&&crypto.timingSafeEqual(derived,expected);
}
const cookies=req=>parseCookies(String(req.get('cookie')||''));
const cookieOptions=()=>({httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:SESSION_DAYS*86400_000});

export async function createSession(req,res,user){
  await UserSession.deleteMany({userId:user._id,expiresAt:{$lte:new Date()}});
  const older=await UserSession.find({userId:user._id}).sort({createdAt:-1}).skip(9).select('_id').lean();
  if(older.length)await UserSession.deleteMany({_id:{$in:older.map(row=>row._id)}});
  const raw=randomToken();
  const csrfToken=randomToken(24);
  const session=await UserSession.create({
    userId:user._id,tokenHash:hashToken(raw),csrfToken,
    expiresAt:new Date(Date.now()+SESSION_DAYS*86400_000),ip:req.ip,
    userAgent:String(req.get('user-agent')||'').slice(0,300)
  });
  res.cookie(COOKIE,raw,cookieOptions());
  return session;
}
export function clearSessionCookie(res){res.clearCookie(COOKIE,{...cookieOptions(),maxAge:undefined});}

export async function optionalAccount(req,_res,next){
  try{
    const raw=cookies(req)[COOKIE];
    if(!raw)return next();
    const session=await UserSession.findOne({tokenHash:hashToken(raw),expiresAt:{$gt:new Date()}});
    if(!session)return next();
    const user=await User.findOne({_id:session.userId,status:'active'});
    if(!user)return next();
    req.account=user;req.accountSession=session;
    if(Date.now()-new Date(session.lastSeenAt).getTime()>15*60_000){session.lastSeenAt=new Date();session.save().catch(()=>{});}
    next();
  }catch(error){next(error);}
}
/**
 * Resolve an account from a raw Cookie header. Used by the WebSocket upgrade,
 * which sees a bare http request rather than an Express one.
 */
export async function accountFromCookieHeader(header){
  const raw=parseCookies(String(header||''))[COOKIE];
  if(!raw)return null;
  const session=await UserSession.findOne({tokenHash:hashToken(raw),expiresAt:{$gt:new Date()}});
  if(!session)return null;
  return User.findOne({_id:session.userId,status:'active'});
}

export function requireAccount(req,res,next){
  if(!req.account)return res.status(401).json({error:'Sign in to continue.',code:'AUTH_REQUIRED'});
  next();
}
export function requireCsrf(req,res,next){
  const supplied=String(req.get('x-csrf-token')||'');
  if(!req.accountSession||!supplied||supplied!==req.accountSession.csrfToken)
    return res.status(403).json({error:'Your secure session could not be verified. Refresh and try again.',code:'CSRF_FAILED'});
  next();
}
export const publicUser=user=>({
  id:user._id,email:user.email,name:user.name,locale:user.locale,
  emailVerified:Boolean(user.emailVerifiedAt),preferences:user.preferences,savedEvents:user.savedEvents||[]
});
