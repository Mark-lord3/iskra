import { Router } from 'express';
import crypto from 'node:crypto';
import Order from '../models/Order.js';
import ScanLog from '../models/ScanLog.js';
import ScannerSession from '../models/ScannerSession.js';
import Ticket from '../models/Ticket.js';
import crypto2 from 'node:crypto';
import { hashToken, readInvite, requireScanner } from '../lib/scannerAuth.js';

const r = Router();

/* Doors are loud and fast: a ticket may be re-presented, but a device should
   never be able to hammer the API. */
const GRACE_HOURS = 8;   // a ticket stays valid this long after doors open

/** The only ticket fields a door device ever sees. No email, no price, no order. */
const doorTicket = t => ({
  reference: t.reference,
  guest: t.buyerName,
  tier: t.tier,
  eventTitle: t.eventTitle,
  eventSlug: t.eventSlug,
  eventDate: t.eventDate,
  room: t.room,
  status: t.status,
  admissionValid: t.admissionValid !== false,
  redeemedAt: t.redeemedAt
});

const log = (req, outcome, ticket) => ScanLog.create({
  sessionId: req.scanner?._id,
  label: req.scanner?.label || '',
  reference: ticket?.reference || String(req.body?.code || '').slice(0, 40),
  ticketId: ticket?._id || null,
  outcome,
  eventSlug: ticket?.eventSlug || '',
  ip: req.ip
}).catch(() => {});

/* ------------------------------------------------------------------ session */

// Exchange a signed invite for a device session. The raw token is returned
// once and stored only as a hash.
r.post('/session', async (req, res, next) => {
  try{
    const invite = readInvite(req.body.invite);
    if(!invite) return res.status(401).json({ error:'This link is invalid or has expired.', code:'BAD_INVITE' });

    const raw = crypto.randomBytes(32).toString('base64url');
    const session = await ScannerSession.create({
      tokenHash: hashToken(raw),
      inviteId: invite.jti,
      label: invite.label,
      eventSlug: invite.eventSlug || null,
      expiresAt: new Date(Date.now() + invite.sessionDays * 86400_000),
      userAgent: String(req.get('user-agent') || '').slice(0, 200),
      ip: req.ip
    });

    res.status(201).json({
      token: raw,
      label: session.label,
      eventSlug: session.eventSlug,
      expiresAt: session.expiresAt
    });
  }catch(e){
    if(e?.code === 11000 && e?.keyPattern?.inviteId)
      return res.status(409).json({ error:'This onboarding link has already been used.', code:'INVITE_USED' });
    next(e);
  }
});

/**
 * Passcode sign-in for door staff.
 *
 * A shared passcode is convenient at a busy entrance, but it is deliberately
 * NOT the administrator password: it opens the scanner and nothing else, and
 * rotating it costs one environment variable.
 */
r.post('/passcode', async (req, res, next) => {
  try{
    const configured = process.env.SCANNER_PASSCODE || '';
    if(!configured)
      return res.status(503).json({ error:'Passcode sign-in is not enabled.', code:'NO_PASSCODE' });

    const given = String(req.body.passcode || '');
    const a = Buffer.from(given), b = Buffer.from(configured);
    const ok = a.length === b.length && crypto2.timingSafeEqual(a, b);
    if(!ok) return res.status(401).json({ error:'That passcode is not correct.', code:'BAD_PASSCODE' });

    const raw = crypto.randomBytes(32).toString('base64url');
    const session = await ScannerSession.create({
      tokenHash: hashToken(raw),
      label: String(req.body.label || 'Door (passcode)').slice(0, 60),
      eventSlug: null,
      expiresAt: new Date(Date.now() + 86400_000),   // one shift, not three days
      userAgent: String(req.get('user-agent') || '').slice(0, 200),
      ip: req.ip
    });
    res.status(201).json({ token: raw, label: session.label, eventSlug: null, expiresAt: session.expiresAt });
  }catch(e){ next(e); }
});

// Session self-check, used on every page load to decide whether to show the camera.
r.get('/me', requireScanner, async (req, res, next) => {
  try{
    await req.scanner.save();
    res.json({
      label: req.scanner.label,
      eventSlug: req.scanner.eventSlug,
      expiresAt: req.scanner.expiresAt,
      scanCount: req.scanner.scanCount,
      admitCount: req.scanner.admitCount
    });
  }catch(e){ next(e); }
});

/* ------------------------------------------------------------------ scanning */

/** Shared lookup and policy for both verify and redeem. */
async function resolve(req){
  const code = String(req.body.code || '').trim();
  if(!code) return { http:400, outcome:'invalid', error:'No code supplied.' };

  // The QR carries an unpredictable secret; a bare reference is accepted too
  // for the manual fallback, but either way the server is the only judge.
  const ticket = await Ticket.findOne({
    $or: [{ qrPayload: code }, { reference: code.toUpperCase() }]
  }).select('+qrPayload');

  if(!ticket) return { http:404, outcome:'invalid', error:'Ticket not found.' };

  if(ticket.admissionValid===false)
    return {http:409,outcome:'reservation_only',ticket,error:'This QR reserves a VIP table but is not an admission ticket.'};

  const scope = req.scanner.eventSlug;
  if(scope && ticket.eventSlug !== scope)
    return { http:409, outcome:'wrong_event', ticket, error:'This ticket is for another night.' };

  if(ticket.status === 'cancelled')
    return { http:409, outcome:'cancelled', ticket, error:'This ticket was cancelled or refunded.' };

  const doorsClosed = new Date(ticket.eventDate).getTime() + GRACE_HOURS * 3600_000;
  if(Date.now() > doorsClosed)
    return { http:409, outcome:'expired', ticket, error:'This ticket is for a past night.' };

  // A paid tier with no completed order must not be admitted.
  if(ticket.price > 0){
    if(!ticket.orderId)
      return { http:409, outcome:'unpaid', ticket, error:'This paid ticket has no verified order.' };
    const order = await Order.findById(ticket.orderId).select('status paymentStatus').lean();
    if(!order || !['paid','complete','free'].includes(order.status))
      return { http:409, outcome:'unpaid', ticket, error:'Payment for this ticket is not complete.' };
  }

  if(ticket.status === 'redeemed')
    return { http:409, outcome:'already_used', ticket, error:'Ticket was already used.' };

  return { http:200, outcome:'valid', ticket };
}

// Read-only check. Never changes ticket state.
r.post('/verify', requireScanner, async (req, res, next) => {
  try{
    const out = await resolve(req);
    req.scanner.scanCount += 1;
    await req.scanner.save();
    log(req, 'verify_' + out.outcome, out.ticket);
    res.status(out.http === 200 ? 200 : out.http).json({
      outcome: out.outcome,
      error: out.error,
      ticket: out.ticket ? doorTicket(out.ticket) : null
    });
  }catch(e){ next(e); }
});

/**
 * Redeem. The state change is a single conditional update, so if two doors
 * scan the same ticket at the same instant exactly one of them wins and the
 * other is told the authoritative redemption time.
 */
r.post('/redeem', requireScanner, async (req, res, next) => {
  try{
    const out = await resolve(req);
    if(out.outcome !== 'valid'){
      req.scanner.scanCount += 1;
      await req.scanner.save();
      log(req, out.outcome, out.ticket);
      return res.status(out.http).json({
        outcome: out.outcome,
        error: out.error,
        ticket: out.ticket ? doorTicket(out.ticket) : null
      });
    }

    const now = new Date();
    const claimed = await Ticket.findOneAndUpdate(
      { _id: out.ticket._id, status:'reserved', redeemedAt: null },   // the guard
      { $set: { status:'redeemed', redeemedAt: now } },
      { new: true }
    );

    req.scanner.scanCount += 1;
    if(claimed) req.scanner.admitCount += 1;
    await req.scanner.save();

    if(!claimed){
      // Lost the race: report the winner's timestamp, never a second entry.
      const current = await Ticket.findById(out.ticket._id);
      log(req, 'already_used', current);
      return res.status(409).json({
        outcome:'already_used',
        error:'Ticket was already used.',
        ticket: doorTicket(current)
      });
    }

    log(req, 'admitted', claimed);
    res.json({ outcome:'admitted', ticket: doorTicket(claimed), scannedAt: now, admitCount: req.scanner.admitCount });
  }catch(e){ next(e); }
});

export default r;
