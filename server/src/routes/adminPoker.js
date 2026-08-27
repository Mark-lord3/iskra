import { Router } from 'express';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Tournament from '../models/PokerTournament.js';
import RulesVersion from '../models/TournamentRulesVersion.js';
import Prize from '../models/TournamentPrize.js';
import Registration from '../models/TournamentRegistration.js';
import Result from '../models/TournamentResult.js';
import Round from '../models/TournamentRound.js';
import Table from '../models/PokerTable.js';
import Seat from '../models/PokerSeat.js';
import Hand from '../models/PokerHand.js';
import Audit from '../models/TournamentAuditEvent.js';
import PlayerReport from '../models/PlayerReport.js';
import Event from '../models/Event.js';
import { requireAdmin } from '../lib/adminAuth.js';
import { canPublish } from '../poker/lifecycle.js';
import { defaultBlindSchedule } from '../poker/structure.js';
import { move, startTournament, pauseTournament, resumeTournament,
         cancelTournament, audit } from '../poker/tournamentOps.js';
import { fulfillPrizes } from '../poker/fulfillment.js';
import { engine } from '../poker/runtime.js';

const router = Router();
router.use(requireAdmin);

const oid = v => mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(String(v)) : null;
const fail = (res, status, code, error, extra={}) => res.status(status).json({ error, code, ...extra });
const who = req => req.admin?.email || 'admin';

const slugify = s => String(s).toLowerCase().normalize('NFKD')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60);

/* ------------------------------------------------------------------- list */

router.get('/tournaments', async (req, res, next) => {
  try {
    const list = await Tournament.find({}).sort({ createdAt: -1 }).limit(60).lean();
    const ids = list.map(t => t._id);
    const [counts, prizes] = await Promise.all([
      Registration.aggregate([
        { $match:{ tournament:{ $in: ids }, status:{ $in:['registered','checked_in'] } } },
        { $group:{ _id:'$tournament', n:{ $sum:1 } } }
      ]),
      Prize.find({ tournament:{ $in: ids } }).lean()
    ]);
    res.json(list.map(t => ({
      ...t,
      registeredCount: counts.find(c => String(c._id) === String(t._id))?.n || 0,
      prizeCount: prizes.filter(p => String(p.tournament) === String(t._id)).length,
      publishBlockers: Tournament.hydrate(t).publishBlockers(
        prizes.filter(p => String(p.tournament) === String(t._id)).length)
    })));
  } catch(err){ next(err); }
});

router.get('/tournaments/:id', async (req, res, next) => {
  try {
    const id = oid(req.params.id);
    const tournament = id && await Tournament.findById(id).lean();
    if(!tournament) return fail(res, 404, 'NOT_FOUND', 'Tournament not found.');
    const [prizes, rules, registrations, rounds, tables, auditLog, results] = await Promise.all([
      Prize.find({ tournament: id }).sort({ placement:1 }).lean(),
      RulesVersion.find({ tournament: id }).sort({ version:-1, locale:1 }).lean(),
      Registration.find({ tournament: id }).sort({ registeredAt:1 }).limit(500).lean(),
      Round.find({ tournament: id }).sort({ number:1 }).lean(),
      Table.find({ tournament: id }).sort({ label:1 }).lean(),
      Audit.find({ tournament: id }).sort({ at:-1 }).limit(80).lean(),
      Result.find({ tournament: id }).sort({ placement:1 }).lean()
    ]);
    res.json({
      tournament: { ...tournament,
        publishBlockers: Tournament.hydrate(tournament).publishBlockers(prizes.length) },
      prizes, rules, registrations, rounds, tables, audit: auditLog, results,
      liveTables: engine.liveTablesFor(id).map(t => ({
        id: t.id, handNumber: t.handNumber, paused: t.paused,
        seated: [...t.seats.values()].filter(s => s.stack > 0).length }))
    });
  } catch(err){ next(err); }
});

/* ----------------------------------------------------------------- drafts */

router.post('/tournaments', async (req, res, next) => {
  try {
    const body = req.body || {};
    const id = oid(body.id);
    const existing = id && await Tournament.findById(id);
    if(id && !existing) return fail(res, 404, 'NOT_FOUND', 'Tournament not found.');

    // Once players can enter, the terms they entered under are fixed.
    if(existing?.structureFrozenAt)
      for(const locked of ['startingStack','tableSize','blindSchedule','advancement'])
        delete body[locked];

    if(!body.title || !body.eventSlug || !body.startsAt || !body.registrationClosesAt)
      return fail(res, 400, 'BAD_REQUEST', 'Title, event, start time and registration close time are required.');
    if(!await Event.findOne({ slug: body.eventSlug }).lean())
      return fail(res, 400, 'UNKNOWN_EVENT', 'That event does not exist.');

    const patch = {
      title: String(body.title).slice(0,120),
      eventSlug: String(body.eventSlug),
      timezone: body.timezone || 'America/Toronto',
      registrationOpensAt: body.registrationOpensAt || null,
      registrationClosesAt: body.registrationClosesAt,
      checkInClosesAt: body.checkInClosesAt || null,
      startsAt: body.startsAt,
      lateRegistration: body.lateRegistration === true,
      minimumAge: Number(body.minimumAge) || 18,
      eligibilityRegion: String(body.eligibilityRegion || ''),
      prizeClaimDeadlineDays: Number(body.prizeClaimDeadlineDays) || 30,
      ...(body.tableSize ? { tableSize: Number(body.tableSize) } : {}),
      maxPlayers: body.maxPlayers === '' || body.maxPlayers == null ? null : Number(body.maxPlayers),
      ...(body.startingStack ? { startingStack: Number(body.startingStack) } : {}),
      ...(body.actionTimerSeconds ? { actionTimerSeconds: Number(body.actionTimerSeconds) } : {}),
      ...(body.timeBankSeconds != null ? { timeBankSeconds: Number(body.timeBankSeconds) } : {}),
      ...(Array.isArray(body.blindSchedule) && body.blindSchedule.length ? { blindSchedule: body.blindSchedule } : {}),
      ...(body.advancement ? { advancement: body.advancement } : {})
    };

    if(existing){
      // Editing the terms invalidates the sign-off; it has to be reviewed again.
      const material = ['startsAt','registrationClosesAt','minimumAge','eligibilityRegion','prizeClaimDeadlineDays'];
      const changed = material.some(k => String(existing[k] ?? '') !== String(patch[k] ?? ''));
      if(changed && existing.legalReviewStatus === 'approved' && existing.state === 'draft'){
        patch.legalReviewStatus = 'changes_requested';
        patch.legalApprovedAt = null;
        await audit(existing._id, { type:'legal_review_invalidated', actorType:'system',
          actor: who(req), reason:'tournament terms changed after approval' });
      }
      await Tournament.updateOne({ _id: existing._id }, { $set: patch });
      await audit(existing._id, { type:'tournament_updated', actorType:'admin', actor: who(req), detail: patch });
      return res.json(await Tournament.findById(existing._id).lean());
    }

    const slug = `${slugify(body.title)}-${crypto.randomBytes(3).toString('hex')}`;
    const created = await Tournament.create({
      ...patch, slug, state:'draft',
      blindSchedule: patch.blindSchedule?.length ? patch.blindSchedule : defaultBlindSchedule()
    });
    await audit(created._id, { type:'tournament_created', actorType:'admin', actor: who(req) });
    res.status(201).json(created.toObject());
  } catch(err){ next(err); }
});

/* ----------------------------------------------------------------- prizes */

router.put('/tournaments/:id/prizes', async (req, res, next) => {
  try {
    const id = oid(req.params.id);
    const tournament = id && await Tournament.findById(id);
    if(!tournament) return fail(res, 404, 'NOT_FOUND', 'Tournament not found.');
    if(tournament.state !== 'draft' && tournament.state !== 'scheduled')
      return fail(res, 409, 'LOCKED', 'Prizes cannot change once registration has opened.');

    const rows = Array.isArray(req.body?.prizes) ? req.body.prizes : [];
    if(rows.length !== 3) return fail(res, 400, 'BAD_REQUEST', 'Configure all three placements.');

    for(const row of rows){
      const placement = Number(row.placement);
      if(![1,2,3].includes(placement)) return fail(res, 400, 'BAD_REQUEST', 'Placements must be 1, 2 and 3.');
      if(!row.eventSlug || !await Event.findOne({ slug: row.eventSlug }).lean())
        return fail(res, 400, 'UNKNOWN_EVENT', 'Each prize must point at a real event.');
      if(!(Number(row.ticketQuantity) >= 1)) return fail(res, 400, 'BAD_REQUEST', 'Each prize needs at least one ticket.');
      // The retail value has to be disclosed, so it cannot be left blank.
      if(!(Number(row.approximateRetailValue) >= 0))
        return fail(res, 400, 'BAD_REQUEST', 'State the approximate retail value of each prize.');

      await Prize.findOneAndUpdate({ tournament: id, placement },
        { $set:{ eventSlug: row.eventSlug, ticketTier: String(row.ticketTier || 'General admission'),
                 ticketQuantity: Number(row.ticketQuantity),
                 approximateRetailValue: Number(row.approximateRetailValue),
                 currency: row.currency || 'CAD', restrictions: String(row.restrictions || '') } },
        { upsert:true, setDefaultsOnInsert:true });
    }
    await audit(id, { type:'prizes_configured', actorType:'admin', actor: who(req) });
    res.json(await Prize.find({ tournament: id }).sort({ placement:1 }).lean());
  } catch(err){ next(err); }
});

/* ------------------------------------------------------------------ rules */

/**
 * Publish a rules version. The text is written by a person and stored exactly
 * as supplied — nothing here drafts legal language, and an empty or
 * placeholder document is refused rather than quietly accepted.
 */
router.post('/tournaments/:id/rules', async (req, res, next) => {
  try {
    const id = oid(req.params.id);
    const tournament = id && await Tournament.findById(id);
    if(!tournament) return fail(res, 404, 'NOT_FOUND', 'Tournament not found.');

    const locale = ['en','uk','ru'].includes(req.body?.locale) ? req.body.locale : 'en';
    const body = String(req.body?.bodyMarkdown || '').trim();
    if(body.length < 400)
      return fail(res, 400, 'RULES_TOO_SHORT',
        'Paste the full official rules as approved by your reviewer. This field is stored verbatim and is not drafted for you.');
    if(/lorem ipsum|TODO|TBD|placeholder/i.test(body))
      return fail(res, 400, 'RULES_PLACEHOLDER', 'The rules still contain placeholder text.');

    const latest = await RulesVersion.findOne({ tournament: id }).sort({ version:-1 }).lean();
    const version = req.body?.version ? Number(req.body.version) : (latest?.version || 0) + 1;
    const contentHash = crypto.createHash('sha256').update(body).digest('hex');

    const doc = await RulesVersion.findOneAndUpdate(
      { tournament: id, version, locale },
      { $set:{ bodyMarkdown: body, disclosures: req.body?.disclosures || {}, contentHash } },
      { upsert:true, new:true, setDefaultsOnInsert:true });

    // The English version is the one the tournament points at; translations
    // ride alongside at the same version number.
    if(locale === 'en') await Tournament.updateOne({ _id: id }, { $set:{ rulesVersion: doc._id } });
    await audit(id, { type:'rules_version_saved', actorType:'admin', actor: who(req),
      detail:{ version, locale, contentHash } });
    res.status(201).json(doc.toObject());
  } catch(err){ next(err); }
});

/**
 * Record a legal review decision.
 *
 * This stores what a human reviewer decided. It does not assess compliance and
 * is not itself legal advice; it exists so publication cannot happen until a
 * named person has signed off and that sign-off is on the record.
 */
router.post('/tournaments/:id/legal-review', async (req, res, next) => {
  try {
    const id = oid(req.params.id);
    const tournament = id && await Tournament.findById(id);
    if(!tournament) return fail(res, 404, 'NOT_FOUND', 'Tournament not found.');

    const status = ['not_reviewed','in_review','changes_requested','approved'].includes(req.body?.status)
      ? req.body.status : null;
    if(!status) return fail(res, 400, 'BAD_REQUEST', 'Choose a review status.');

    const reviewer = String(req.body?.reviewer || '').trim();
    if(status === 'approved'){
      if(reviewer.length < 3)
        return fail(res, 400, 'REVIEWER_REQUIRED', 'Record the name of the reviewer who approved these rules.');
      if(!tournament.rulesVersion)
        return fail(res, 400, 'NO_RULES_VERSION', 'Save the official rules before recording approval.');
    }

    await Tournament.updateOne({ _id: id }, { $set:{
      legalReviewStatus: status, legalReviewer: reviewer,
      legalApprovedAt: status === 'approved' ? new Date() : null } });
    await audit(id, { type:`legal_${status}`, actorType:'admin', actor: who(req),
      reason: String(req.body?.note || ''), detail:{ reviewer } });
    res.json(await Tournament.findById(id).lean());
  } catch(err){ next(err); }
});

/* ------------------------------------------------------------- lifecycle */

const step = to => async (req, res, next) => {
  try {
    const id = oid(req.params.id);
    const tournament = id && await Tournament.findById(id);
    if(!tournament) return fail(res, 404, 'NOT_FOUND', 'Tournament not found.');
    const outcome = await move(tournament, to, { actor: who(req), reason: String(req.body?.reason || '') });
    if(!outcome.ok) return fail(res, 409, outcome.code, blockerMessage(outcome), { blockers: outcome.blockers });
    res.json(await Tournament.findById(id).lean());
  } catch(err){ next(err); }
};

router.post('/tournaments/:id/publish', step('scheduled'));
router.post('/tournaments/:id/open-registration', step('registration_open'));
router.post('/tournaments/:id/lock-registration', step('registration_locked'));

router.post('/tournaments/:id/start', async (req, res, next) => {
  try {
    const outcome = await startTournament(oid(req.params.id), { actor: who(req) });
    if(!outcome.ok) return fail(res, 409, outcome.code, blockerMessage(outcome), outcome);
    res.json(outcome);
  } catch(err){ next(err); }
});

router.post('/tournaments/:id/pause', async (req, res, next) => {
  try {
    const outcome = await pauseTournament(oid(req.params.id), { actor: who(req), reason: String(req.body?.reason||'') });
    if(!outcome.ok) return fail(res, 409, outcome.code, blockerMessage(outcome));
    res.json({ ok:true });
  } catch(err){ next(err); }
});

router.post('/tournaments/:id/resume', async (req, res, next) => {
  try {
    const outcome = await resumeTournament(oid(req.params.id), { actor: who(req) });
    if(!outcome.ok) return fail(res, 409, outcome.code, blockerMessage(outcome));
    res.json({ ok:true, state: outcome.state });
  } catch(err){ next(err); }
});

router.post('/tournaments/:id/cancel', async (req, res, next) => {
  try {
    const reason = String(req.body?.reason || '').trim();
    if(reason.length < 4) return fail(res, 400, 'REASON_REQUIRED', 'Record why the tournament is being cancelled.');
    const outcome = await cancelTournament(oid(req.params.id), { actor: who(req), reason });
    if(!outcome.ok) return fail(res, 409, outcome.code, blockerMessage(outcome));
    res.json({ ok:true });
  } catch(err){ next(err); }
});

router.post('/tournaments/:id/fulfill-prizes', async (req, res, next) => {
  try {
    const outcome = await fulfillPrizes(oid(req.params.id), { actor: who(req) });
    if(!outcome.ok) return fail(res, 409, outcome.code, 'Prizes can only be issued once the tournament is complete.');
    res.json(outcome);
  } catch(err){ next(err); }
});

/* -------------------------------------------------------------- integrity */

router.post('/tournaments/:id/disqualify', async (req, res, next) => {
  try {
    const id = oid(req.params.id), user = oid(req.body?.user);
    const reason = String(req.body?.reason || '').trim();
    if(!user || reason.length < 4)
      return fail(res, 400, 'BAD_REQUEST', 'A player and a written reason are required.');
    await Registration.updateOne({ tournament: id, user },
      { $set:{ status:'disqualified', disqualifiedReason: reason } });
    await Result.updateOne({ tournament: id, user }, { $set:{ prizeStatus:'manual_review' } });
    await Seat.updateMany({ tournament: id, user }, { $set:{ status:'eliminated' } });
    await audit(id, { type:'player_disqualified', actorType:'admin', actor: who(req),
      subjectUser: user, reason });
    res.json({ ok:true });
  } catch(err){ next(err); }
});

router.get('/reports', async (req, res, next) => {
  try {
    res.json(await PlayerReport.find({ status:{ $in:['open','reviewing'] } })
      .sort({ createdAt:-1 }).limit(100).lean());
  } catch(err){ next(err); }
});

router.patch('/reports/:id', async (req, res, next) => {
  try {
    const status = ['open','reviewing','actioned','dismissed'].includes(req.body?.status) ? req.body.status : null;
    if(!status) return fail(res, 400, 'BAD_REQUEST', 'Choose a review status.');
    const updated = await PlayerReport.findByIdAndUpdate(oid(req.params.id),
      { $set:{ status, reviewNote: String(req.body?.note || ''), reviewedAt: new Date() } }, { new:true });
    if(!updated) return fail(res, 404, 'NOT_FOUND', 'Report not found.');
    res.json(updated.toObject());
  } catch(err){ next(err); }
});

/** Hand history for dispute resolution, including the revealed shuffle seed. */
router.get('/tables/:id/hands', async (req, res, next) => {
  try {
    const hands = await Hand.find({ table: oid(req.params.id), completedAt:{ $ne:null } })
      .select('+shuffleSeed').sort({ handNumber:-1 }).limit(40).lean();
    res.json(hands);
  } catch(err){ next(err); }
});

const BLOCKER_TEXT = {
  LEGAL_NOT_APPROVED:'A legal reviewer has not approved this tournament yet.',
  NO_RULES_VERSION:'No official rules have been saved.',
  NO_APPROVAL_TIMESTAMP:'The approval has no recorded timestamp.',
  NEEDS_THREE_PLACEMENTS:'Configure prizes for all three placements.',
  NO_SCHEDULE:'Set the registration close time and the start time.',
  REGISTRATION_AFTER_START:'Registration must close before the tournament starts.',
  MUST_BE_FREE:'Entry must remain free.'
};

function blockerMessage(outcome){
  if(outcome.blockers?.length)
    return 'Cannot publish yet: ' + outcome.blockers.map(b => BLOCKER_TEXT[b] || b).join(' ');
  return {
    ILLEGAL_TRANSITION:'That is not a valid next step for this tournament.',
    NOT_ENOUGH_PLAYERS:'At least two registered players are needed to start.',
    NOT_READY:'Close registration before starting the tournament.',
    NOT_PAUSED:'The tournament is not paused.',
    NO_RESUME_STATE:'There is no recorded state to resume to.'
  }[outcome.code] || 'That action could not be completed.';
}

export default router;
