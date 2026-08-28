import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import { secretValue } from '../config/security.js';

const ROUNDS   = Number(process.env.BCRYPT_ROUNDS || 12);
const LOCK_MS  = Number(process.env.ADMIN_LOCK_MS || 15 * 60_000);
const MAX_FAILS = 5;
export const COOKIE = 'iskra_admin_session';
const TTL_HOURS = 12;

const secret = () => secretValue('JWT_SECRET', { minLength:32 });

export const hashPassword = pw => bcrypt.hash(pw, ROUNDS);

/** Issues the session cookie. httpOnly keeps it out of reach of any script. */
export function setSessionCookie(res, admin){
  const token = jwt.sign(
    { sub: String(admin._id), email: admin.email, role: admin.role },
    secret(),
    { expiresIn: `${TTL_HOURS}h` }
  );
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',                       // blocks cross-site use of the session
    secure: process.env.NODE_ENV === 'production',
    maxAge: TTL_HOURS * 3600_000,
    path: '/'
  });
  return token;
}

export const clearSessionCookie = res =>
  res.clearCookie(COOKIE, { httpOnly:true, sameSite:'strict', path:'/',
    secure: process.env.NODE_ENV === 'production' });

/**
 * Verifies email and password, applying the lockout policy.
 * @returns {{ok:true, admin}|{ok:false, code:string, retryAfterMs?:number}}
 */
export async function authenticate(email, password){
  const admin = await Admin.findOne({ email: String(email || '').toLowerCase().trim() })
    .select('+passwordHash');
  // Same generic answer whether the address exists or not.
  if(!admin) return { ok:false, code:'BAD_CREDENTIALS' };

  if(admin.isLocked())
    return { ok:false, code:'LOCKED', retryAfterMs: admin.lockedUntil - Date.now() };

  const good = await bcrypt.compare(String(password || ''), admin.passwordHash);
  if(!good){
    admin.failedAttempts += 1;
    if(admin.failedAttempts >= MAX_FAILS){
      admin.lockedUntil = new Date(Date.now() + LOCK_MS);
      admin.failedAttempts = 0;
    }
    await admin.save();
    return { ok:false, code: admin.isLocked() ? 'LOCKED' : 'BAD_CREDENTIALS',
             retryAfterMs: admin.isLocked() ? LOCK_MS : undefined };
  }

  admin.failedAttempts = 0; admin.lockedUntil = null; admin.lastLoginAt = new Date();
  await admin.save();
  return { ok:true, admin };
}

/** Guard for the dashboard API. Accepts only a signed admin session cookie. */
export async function requireAdmin(req, res, next){
  try{
    const token = req.cookies?.[COOKIE];
    if(!token) return res.status(401).json({ error:'Sign in to continue.', code:'NO_SESSION' });
    let claims;
    try{ claims = jwt.verify(token, secret()); }
    catch{ return res.status(401).json({ error:'Your session expired. Sign in again.', code:'EXPIRED' }); }

    const admin = await Admin.findById(claims.sub);
    if(!admin) return res.status(401).json({ error:'Sign in to continue.', code:'NO_SESSION' });
    // A password change invalidates every session issued before it.
    if(admin.passwordChangedAt && claims.iat * 1000 < admin.passwordChangedAt.getTime())
      return res.status(401).json({ error:'Your session expired. Sign in again.', code:'EXPIRED' });

    req.admin = admin;
    next();
  }catch(e){ next(e); }
}

/** Creates the first administrator from the environment, once. */
export async function seedFirstAdmin(){
  const email = String(process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;
  if(!email || !password) return null;
  const existing = await Admin.findOne({ email });
  if(existing) return existing;
  const admin = await Admin.create({
    email, name: 'ISKRA operations', role:'owner',
    passwordHash: await hashPassword(password)
  });
  console.log('  ✓ Administrator created for %s', email);
  return admin;
}
