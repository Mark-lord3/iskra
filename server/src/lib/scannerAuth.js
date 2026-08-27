import crypto from 'node:crypto';
import ScannerSession from '../models/ScannerSession.js';

/* Invites are signed with a dedicated secret so a leaked admin key alone
   cannot mint door access, and vice versa. */
const secret = () =>
  process.env.SCANNER_SECRET ||
  crypto.createHash('sha256').update('scanner:' + (process.env.ADMIN_KEY || 'iskra-local-admin')).digest('hex');

export const hashToken = raw => crypto.createHash('sha256').update(String(raw)).digest('hex');

const sign = payload => {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
};

/** @returns {object|null} the payload when the signature and expiry both hold */
export function readInvite(token){
  const [body, mac] = String(token || '').split('.');
  if(!body || !mac) return null;
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(expected);
  if(a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try{
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if(!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  }catch{ return null; }
}

/** Signed, expiring onboarding token an administrator hands to a door device. */
export function createInvite({ label, eventSlug = null, ttlMinutes = 30, sessionDays = 3 }){
  return sign({
    v: 1,
    label: String(label || 'Door device').slice(0, 60),
    eventSlug: eventSlug || null,
    sessionDays: Math.min(30, Math.max(1, Number(sessionDays) || 3)),
    exp: Date.now() + Math.min(24 * 60, Math.max(1, Number(ttlMinutes) || 30)) * 60_000
  });
}

/**
 * Express guard for every scanner route. Accepts only a scanner session token;
 * an admin key is deliberately not accepted here, keeping the two roles apart.
 */
export async function requireScanner(req, res, next){
  try{
    const raw = req.get('x-scanner-token');
    if(!raw) return res.status(401).json({ error:'Scanner session required.', code:'NO_SESSION' });

    const session = await ScannerSession.findOne({ tokenHash: hashToken(raw) });
    if(!session) return res.status(401).json({ error:'Scanner session required.', code:'NO_SESSION' });
    if(session.revokedAt) return res.status(403).json({ error:'This device was revoked.', code:'REVOKED' });
    if(session.expiresAt <= new Date())
      return res.status(403).json({ error:'This device session expired.', code:'EXPIRED' });

    session.lastSeenAt = new Date();
    req.scanner = session;
    next();
  }catch(e){ next(e); }
}
