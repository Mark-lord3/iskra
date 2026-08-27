import { Router } from 'express';
import mongoose from 'mongoose';
import Tournament from '../models/PokerTournament.js';
import Registration from '../models/TournamentRegistration.js';
import RulesVersion from '../models/TournamentRulesVersion.js';
import Prize from '../models/TournamentPrize.js';
import Result from '../models/TournamentResult.js';
import Round from '../models/TournamentRound.js';
import Table from '../models/PokerTable.js';
import Seat from '../models/PokerSeat.js';
import Hand from '../models/PokerHand.js';
import PlayerReport from '../models/PlayerReport.js';
import Audit from '../models/TournamentAuditEvent.js';
import User from '../models/User.js';
import { optionalAccount, requireAccount, requireCsrf } from '../lib/accountAuth.js';
import { canRegister } from '../poker/lifecycle.js';
import { engine } from '../poker/runtime.js';
import { createDemo, getDemo, actDemo, nextDemoHand, endDemo } from '../poker/demo.js';
import { validateDisplayName } from '../../../shared/displayName.js';

const router = Router();
router.use(optionalAccount);

const PUBLIC_STATES = ['scheduled','registration_open','registration_locked',
                       'round_one','round_two','final_round','completed','paused'];
const RUNNING = ['round_one','round_two','final_round'];

const oid = value => mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(String(value)) : null;
const fail = (res, status, code, error, extra = {}) => res.status(status).json({ error, code, ...extra });

/**
 * The public shape of a tournament. Entry is free, so there is no price to
 * show; what matters to a player is when it opens, what can be won, and the
 * fact that nothing is ever for sale here.
 */
const publicTournament = (t, extra = {}) => ({
  id: t._id, slug: t.slug, title: t.title, eventSlug: t.eventSlug,
  state: t.state, timezone: t.timezone,
  registrationOpensAt: t.registrationOpensAt, registrationClosesAt: t.registrationClosesAt,
  startsAt: t.startsAt, checkInClosesAt: t.checkInClosesAt,
  tableSize: t.tableSize, startingStack: t.startingStack,
  actionTimerSeconds: t.actionTimerSeconds, timeBankSeconds: t.timeBankSeconds,
  minimumAge: t.minimumAge, eligibilityRegion: t.eligibilityRegion,
  prizeClaimDeadlineDays: t.prizeClaimDeadlineDays,
  // This is the immutable document id registration must echo back. It is not
  // the human-facing version number and does not depend on translation.
  rulesVersion: t.rulesVersion ? String(t.rulesVersion) : null,
  noPurchaseNecessary: true, entryCost: 0, chipsHaveNoCashValue: true,
  ...extra
});

const publicPrize = p => ({
  placement: p.placement, eventSlug: p.eventSlug, ticketTier: p.ticketTier,
  ticketQuantity: p.ticketQuantity, approximateRetailValue: p.approximateRetailValue,
  currency: p.currency, restrictions: p.restrictions
});

/* ------------------------------------------------------------------ lobby */

/** Published tournaments only. A draft is invisible until legal sign-off. */
router.get('/tournaments', async (req, res, next) => {
  try {
    const list = await Tournament.find({ state:{ $in: PUBLIC_STATES }, publishedAt:{ $ne: null } })
      .sort({ startsAt: 1 }).limit(30).lean();

    const ids = list.map(t => t._id);
    const [counts, prizes, mine] = await Promise.all([
      Registration.aggregate([
        { $match:{ tournament:{ $in: ids }, status:{ $in:['registered','checked_in'] } } },
        { $group:{ _id:'$tournament', n:{ $sum:1 } } }
      ]),
      Prize.find({ tournament:{ $in: ids } }).lean(),
      req.account ? Registration.find({ tournament:{ $in: ids }, user: req.account._id }).lean() : []
    ]);

    const countFor = id => counts.find(c => String(c._id) === String(id))?.n || 0;
    res.json(list.map(t => publicTournament(t, {
      registeredCount: countFor(t._id),
      prizes: prizes.filter(p => String(p.tournament) === String(t._id)).sort((a,b)=>a.placement-b.placement).map(publicPrize),
      myStatus: mine.find(r => String(r.tournament) === String(t._id))?.status || null
    })));
  } catch(err){ next(err); }
});

router.get('/tournaments/:id', async (req, res, next) => {
  try {
    const id = oid(req.params.id);
    const tournament = id
      ? await Tournament.findOne({ _id: id, state:{ $in: PUBLIC_STATES }, publishedAt:{ $ne: null } }).lean()
      : await Tournament.findOne({ slug: String(req.params.id), state:{ $in: PUBLIC_STATES }, publishedAt:{ $ne: null } }).lean();
    if(!tournament) return fail(res, 404, 'NOT_FOUND', 'That tournament is not available.');

    const locale = ['en','uk','ru'].includes(req.query.locale) ? req.query.locale : 'en';
    const [prizes, registeredCount, rules, myReg] = await Promise.all([
      Prize.find({ tournament: tournament._id }).sort({ placement: 1 }).lean(),
      Registration.countDocuments({ tournament: tournament._id, status:{ $in:['registered','checked_in'] } }),
      RulesVersion.findOne({ tournament: tournament._id, locale })
        .sort({ version: -1 }).lean()
        .then(found => found || RulesVersion.findOne({ tournament: tournament._id, locale:'en' }).sort({ version:-1 }).lean()),
      req.account ? Registration.findOne({ tournament: tournament._id, user: req.account._id }).lean() : null
    ]);

    res.json(publicTournament(tournament, {
      registeredCount,
      prizes: prizes.map(publicPrize),
      // The identifier of the rules the player must accept. Without it the
      // registration form has nothing to send and entry always fails.
      rulesVersionId: tournament.rulesVersion ? String(tournament.rulesVersion) : null,
      rules: rules ? { version: rules.version, locale: rules.locale, bodyMarkdown: rules.bodyMarkdown,
                       disclosures: rules.disclosures, approvedAt: rules.approvedAt,
                       contentHash: rules.contentHash } : null,
      myRegistration: myReg ? { status: myReg.status, registeredAt: myReg.registeredAt,
                                displayName: myReg.displayName, checkedInAt: myReg.checkedInAt } : null,
      canRegisterNow: tournamentDoc(tournament).registrationOpen()
    }));
  } catch(err){ next(err); }
});

/** Rehydrate a lean object so the schema methods are available. */
const tournamentDoc = lean => Tournament.hydrate(lean);

/* ----------------------------------------------------------- registration */

router.post('/tournaments/:id/register', requireAccount, requireCsrf, async (req, res, next) => {
  try {
    const id = oid(req.params.id);
    if(!id) return fail(res, 404, 'NOT_FOUND', 'That tournament is not available.');
    const tournament = await Tournament.findOne({ _id: id, publishedAt:{ $ne: null } });
    if(!tournament) return fail(res, 404, 'NOT_FOUND', 'That tournament is not available.');

    const name = validateDisplayName(req.body?.displayName);
    if(!name.ok) return fail(res, 400, 'BAD_NAME',
      name.reason === 'blocked' ? 'Choose a different name for the table.'
        : 'Table names are 3 to 18 characters and must contain letters.', { field:'displayName' });

    // Age is confirmed by the player and recorded; it is never assumed.
    if(req.body?.confirmAge === true && !req.account.ageConfirmedAt)
      await User.updateOne({ _id: req.account._id }, { $set:{ ageConfirmedAt: new Date() } });
    const account = {
      emailVerified: Boolean(req.account.emailVerifiedAt),
      ageConfirmed: Boolean(req.account.ageConfirmedAt) || req.body?.confirmAge === true
    };

    const existing = await Registration.findOne({ tournament: tournament._id, user: req.account._id });

    // A full field is refused before anything else is checked, so the message
    // says why rather than blaming the code or the clock.
    if(!existing && tournament.maxPlayers){
      const taken = await Registration.countDocuments({
        tournament: tournament._id, status:{ $in:['registered','checked_in'] } });
      if(taken >= tournament.maxPlayers)
        return fail(res, 409, 'TOURNAMENT_FULL', messageFor('TOURNAMENT_FULL'));
    }

    /* Someone who withdrew may enter again while the window is open. Their row
       is reused rather than replaced, so the unique index still guarantees one
       entry per person. A disqualification, by contrast, was a human decision
       and is not undone by re-registering. */
    if(existing?.status === 'disqualified')
      return fail(res, 403, 'DISQUALIFIED', messageFor('DISQUALIFIED'));
    const active = existing && ['registered','checked_in'].includes(existing.status) ? existing : null;

    const gate = canRegister({
      tournament, account, existingRegistration: active,
      acceptedRulesVersion: req.body?.rulesVersion
    });
    if(!gate.ok) return fail(res, gate.code === 'ALREADY_REGISTERED' ? 409 : 400, gate.code, messageFor(gate.code));

    try {
      const fields = {
        displayName: name.handle,
        status: 'registered',
        rulesVersion: tournament.rulesVersion,
        rulesAcceptedAt: new Date(),
        registeredAt: new Date(),
        checkedInAt: null,
        marketingConsent: req.body?.marketingConsent === true
      };
      // upsert keeps this a single atomic write, so two clicks that race still
      // leave exactly one row.
      const reg = await Registration.findOneAndUpdate(
        { tournament: tournament._id, user: req.account._id },
        { $set: fields },
        { upsert: true, new: true, setDefaultsOnInsert: true });

      res.status(201).json({ ok:true, status: reg.status, displayName: reg.displayName,
        noPurchaseNecessary:true, entryCost:0 });
    } catch(err){
      // The unique index is the real guard against a double click.
      if(err?.code === 11000) return fail(res, 409, 'ALREADY_REGISTERED', messageFor('ALREADY_REGISTERED'));
      throw err;
    }
  } catch(err){ next(err); }
});

router.post('/tournaments/:id/withdraw', requireAccount, requireCsrf, async (req, res, next) => {
  try {
    const id = oid(req.params.id);
    const tournament = id && await Tournament.findById(id);
    if(!tournament) return fail(res, 404, 'NOT_FOUND', 'That tournament is not available.');
    if(RUNNING.includes(tournament.state))
      return fail(res, 409, 'ALREADY_STARTED', 'The tournament has started. You can sit out at the table instead.');
    const updated = await Registration.findOneAndUpdate(
      { tournament: id, user: req.account._id, status:{ $in:['registered','checked_in'] } },
      { $set:{ status:'withdrawn' } }, { new:true });
    if(!updated) return fail(res, 404, 'NOT_REGISTERED', 'You are not registered for this tournament.');
    res.json({ ok:true, status: updated.status });
  } catch(err){ next(err); }
});

router.post('/tournaments/:id/check-in', requireAccount, requireCsrf, async (req, res, next) => {
  try {
    const id = oid(req.params.id);
    const tournament = id && await Tournament.findById(id).lean();
    if(!tournament) return fail(res, 404, 'NOT_FOUND', 'That tournament is not available.');
    if(tournament.checkInClosesAt && Date.now() > new Date(tournament.checkInClosesAt).getTime())
      return fail(res, 409, 'CHECK_IN_CLOSED', 'Check-in has closed for this tournament.');
    const updated = await Registration.findOneAndUpdate(
      { tournament: id, user: req.account._id, status:'registered' },
      { $set:{ status:'checked_in', checkedInAt: new Date() } }, { new:true });
    if(!updated) return fail(res, 404, 'NOT_REGISTERED', 'You are not registered for this tournament.');
    res.json({ ok:true, status: updated.status });
  } catch(err){ next(err); }
});

/* ---------------------------------------------------------------- results */

router.get('/tournaments/:id/results', async (req, res, next) => {
  try {
    const id = oid(req.params.id);
    const tournament = id
      ? await Tournament.findById(id).lean()
      : await Tournament.findOne({ slug: String(req.params.id) }).lean();
    if(!tournament || !tournament.publishedAt) return fail(res, 404, 'NOT_FOUND', 'That tournament is not available.');

    const [results, prizes, rounds] = await Promise.all([
      Result.find({ tournament: tournament._id }).sort({ placement: 1, eliminationOrder: -1 }).lean(),
      Prize.find({ tournament: tournament._id }).sort({ placement: 1 }).lean(),
      Round.find({ tournament: tournament._id }).sort({ number: 1 }).lean()
    ]);

    const mine = req.account
      ? results.find(r => String(r.user) === String(req.account._id))
      : null;
    const myPrize = mine && mine.placement <= 3
      ? await Prize.findOne({ tournament: tournament._id, placement: mine.placement, awardedTo: req.account._id }).lean()
      : null;

    res.json({
      tournament: publicTournament(tournament),
      standings: results.map(r => ({
        placement: r.placement, displayName: r.displayName,
        finishingChips: r.finishingChips, roundReached: r.roundReached,
        prizeStatus: r.prizeStatus
      })),
      prizes: prizes.map(publicPrize),
      rounds: rounds.map(r => ({ number: r.number, name: r.name, status: r.status,
                                 playerCount: r.playerCount, tableCount: r.tableCount })),
      // Ticket references belong to their owner and to nobody else.
      me: mine ? { placement: mine.placement, finishingChips: mine.finishingChips,
                   prizeStatus: mine.prizeStatus,
                   tickets: myPrize?.issuedTicketRefs || [],
                   claimDeadlineAt: myPrize?.claimDeadlineAt || null } : null
    });
  } catch(err){ next(err); }
});

/* ------------------------------------------------------------------ lobby */

/**
 * Everything the tournament lobby renders, in one polled call.
 *
 * The lobby is a control room: field counts, the table map, the bracket, the
 * chip leaderboard and the activity feed all have to agree with each other, so
 * they are read together rather than from six endpoints that could disagree.
 *
 * Privacy is enforced here, not in the browser. Only display names leave this
 * endpoint — never an email, never a hole card, never an administrator's name
 * or the seating seed. Everything a viewer sees is something any spectator is
 * allowed to see.
 */
router.get('/tournaments/:id/lobby', async (req, res, next) => {
  try {
    const id = oid(req.params.id);
    const tournament = id
      ? await Tournament.findOne({ _id: id, publishedAt:{ $ne: null } }).lean()
      : await Tournament.findOne({ slug: String(req.params.id), publishedAt:{ $ne: null } }).lean();
    if(!tournament) return fail(res, 404, 'NOT_FOUND', 'That tournament is not available.');

    const now = new Date();
    const [registrations, rounds, tables, results, prizes] = await Promise.all([
      Registration.find({ tournament: tournament._id }).sort({ registeredAt: 1 }).lean(),
      Round.find({ tournament: tournament._id }).sort({ number: 1 }).lean(),
      Table.find({ tournament: tournament._id }).sort({ label: 1 }).lean(),
      Result.find({ tournament: tournament._id }).lean(),
      Prize.find({ tournament: tournament._id }).sort({ placement: 1 }).lean()
    ]);
    const tableIds = tables.map(t => t._id);
    const seats = tableIds.length
      ? await Seat.find({ table:{ $in: tableIds } }).lean()
      : [];

    const entered = registrations.filter(r => ['registered','checked_in'].includes(r.status));
    const liveSeats = seats.filter(s => ['active','sitting_out','disconnected'].includes(s.status));
    const openTables = tables.filter(t => t.status !== 'completed');

    /* --- the field ---------------------------------------------------- */
    const field = {
      registered: entered.length,
      checkedIn: registrations.filter(r => r.status === 'checked_in').length,
      active: liveSeats.length,
      eliminated: seats.filter(s => s.status === 'eliminated').length,
      withdrawn: registrations.filter(r => r.status === 'withdrawn').length,
      tables: openTables.length,
      totalTables: tables.length,
      openSeats: openTables.reduce((sum, t) => sum + t.size, 0) - liveSeats.length,
      // A cap is optional; when the organiser has not set one there is no limit.
      capacity: tournament.maxPlayers || null
    };

    /* --- the table map. Seat occupancy only; no cards, ever. ----------- */
    const mySeat = req.account
      ? seats.find(s => String(s.user) === String(req.account._id) && s.status !== 'moved')
      : null;

    const tableMap = tables.map(t => {
      const own = seats.filter(s => String(s.table) === String(t._id));
      const live = own.filter(s => ['active','sitting_out','disconnected'].includes(s.status));
      return {
        id: String(t._id), label: t.label, size: t.size, status: t.status,
        handNumber: t.handNumber, blindLevel: t.blindLevel, isFinalTable: t.isFinalTable,
        occupied: live.length, open: Math.max(0, t.size - live.length),
        round: rounds.find(r => String(r._id) === String(t.round))?.name || null,
        seats: own
          .filter(s => s.status !== 'moved')
          .sort((a, b) => a.seatIndex - b.seatIndex)
          .map(s => ({
            seatIndex: s.seatIndex, displayName: s.displayName, stack: s.stack,
            status: s.status, connected: s.status !== 'disconnected',
            isMe: Boolean(req.account) && String(s.user) === String(req.account._id)
          })),
        isMine: Boolean(mySeat) && String(mySeat.table) === String(t._id)
      };
    });

    /* --- the bracket -------------------------------------------------- */
    const bracket = ['round_one','round_two','final_round'].map((name, i) => {
      const round = rounds.find(r => r.name === name);
      const roundTables = round ? tables.filter(t => String(t.round) === String(round._id)) : [];
      const roundSeats = seats.filter(s => roundTables.some(t => String(t._id) === String(s.table)));
      return {
        number: i + 1, name,
        status: round?.status || 'pending',
        playerCount: round?.playerCount ?? 0,
        tableCount: round?.tableCount ?? 0,
        advancementRule: round?.advancementRule || null,
        advancementValue: round?.advancementValue ?? null,
        startedAt: round?.startedAt || null,
        completedAt: round?.completedAt || null,
        survivors: roundSeats.filter(s => ['active','sitting_out','disconnected'].includes(s.status)).length,
        // Whether this viewer reached this round.
        mine: Boolean(req.account) && roundSeats.some(s => String(s.user) === String(req.account._id))
      };
    });

    /* --- chip leaderboard, from real seats and real results ----------- */
    const finished = tournament.state === 'completed';
    const leaderboard = finished
      ? results
          .slice()
          .sort((a, b) => (a.placement ?? 9999) - (b.placement ?? 9999))
          .map(r => ({
            rank: r.placement, displayName: r.displayName, chips: r.finishingChips,
            table: null, round: r.roundReached, status: r.placement <= 3 ? 'winner' : 'out',
            isMe: Boolean(req.account) && String(r.user) === String(req.account._id)
          }))
      : liveSeats
          .slice()
          .sort((a, b) => b.stack - a.stack)
          .map((s, i) => {
            const table = tables.find(t => String(t._id) === String(s.table));
            return {
              rank: i + 1, displayName: s.displayName, chips: s.stack,
              table: table?.label || null,
              round: rounds.find(r => String(r._id) === String(table?.round))?.name || null,
              status: s.status,
              isMe: Boolean(req.account) && String(s.user) === String(req.account._id)
            };
          });

    /* --- activity feed -----------------------------------------------
       Registrations and lifecycle moments only. Audit rows carry an actor and
       a detail object that can name an administrator or the seating seed, so
       nothing from them is forwarded except the event type and its time. */
    const PUBLIC_EVENTS = new Set([
      'state_scheduled','state_registration_open','state_registration_locked',
      'state_round_one','state_round_two','state_final_round','state_completed',
      'state_paused','state_resumed','state_cancelled','round_seated'
    ]);
    const auditRows = await Audit.find({
      tournament: tournament._id, type:{ $in:[...PUBLIC_EVENTS] }
    }).sort({ at: -1 }).limit(40).select('type at').lean();

    const activity = [
      ...auditRows.map(a => ({ kind:'state', type: a.type, at: a.at })),
      ...entered.slice(-25).map(r => ({ kind:'registration', displayName: r.displayName, at: r.registeredAt })),
      ...results.filter(r => r.eliminatedAt).slice(-25)
        .map(r => ({ kind:'elimination', displayName: r.displayName, at: r.eliminatedAt,
                     placement: r.placement }))
    ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 30);

    /* --- this viewer -------------------------------------------------- */
    /* A withdrawn or disqualified entry is not a registration any more: the
       player must be able to see that and, if the window is still open, enter
       again. Matching on the user alone would leave them stuck on a pass they
       no longer hold. */
    const myRegistration = req.account
      ? entered.find(r => String(r.user) === String(req.account._id))
      : null;
    const myWithdrawn = req.account && !myRegistration
      ? registrations.find(r => String(r.user) === String(req.account._id))
      : null;
    const myResult = req.account
      ? results.find(r => String(r.user) === String(req.account._id))
      : null;
    const myTable = mySeat ? tableMap.find(t => t.id === String(mySeat.table)) : null;

    // A registration number that is stable and means something to its owner.
    const myNumber = myRegistration
      ? entered.filter(r => new Date(r.registeredAt) <= new Date(myRegistration.registeredAt)).length
      : null;

    const me = req.account ? {
      signedIn: true,
      name: req.account.name,
      registered: Boolean(myRegistration),
      // Reported so the lobby can explain why the pass is gone.
      previousStatus: myWithdrawn?.status || null,
      status: myRegistration?.status || null,
      displayName: myRegistration?.displayName || null,
      number: myNumber,
      checkedInAt: myRegistration?.checkedInAt || null,
      seat: mySeat ? { tableId: String(mySeat.table), label: myTable?.label || null,
                       seatIndex: mySeat.seatIndex, stack: mySeat.stack, status: mySeat.status } : null,
      round: myTable?.round || null,
      placement: myResult?.placement ?? null,
      prizeStatus: myResult?.prizeStatus || null,
      // Only the server decides whether a table may be opened.
      canOpenTable: Boolean(mySeat) && ['active','sitting_out','disconnected'].includes(mySeat.status)
                    && RUNNING.includes(tournament.state)
    } : { signedIn:false, registered:false };

    /* --- what to count down to --------------------------------------- */
    const countdown = tournament.state === 'registration_open'
      ? { target: tournament.registrationClosesAt, label:'registration_closes' }
      : ['scheduled','registration_locked'].includes(tournament.state)
        ? { target: tournament.startsAt, label:'starts' }
        : null;

    res.json({
      serverTime: now,                       // the clock every countdown uses
      tournament: publicTournament(tournament, {
        registeredCount: entered.length,
        prizes: prizes.map(publicPrize),
        currentRound: bracket.find(b => b.status === 'running')?.name || null
      }),
      countdown, field, tables: tableMap, bracket, leaderboard, activity, me,
      recentRegistrations: entered.slice(-8).reverse()
        .map(r => ({ displayName: r.displayName, at: r.registeredAt }))
    });
  } catch(err){ next(err); }
});

/* ------------------------------------------------------------------ table */

/** Where the signed-in player is seated right now, if anywhere. */
router.get('/my-seat', requireAccount, async (req, res, next) => {
  try {
    const seat = await Seat.findOne({ user: req.account._id, status:{ $in:['active','sitting_out','disconnected'] } })
      .sort({ updatedAt: -1 }).lean();
    if(!seat) return res.json({ seated:false });
    const [table, tournament] = await Promise.all([
      Table.findById(seat.table).lean(),
      Tournament.findById(seat.tournament).lean()
    ]);
    if(!table || table.status === 'completed') return res.json({ seated:false });
    res.json({ seated:true, tableId: String(table._id), label: table.label,
               tournamentId: String(seat.tournament), tournamentTitle: tournament?.title || '',
               seatIndex: seat.seatIndex });
  } catch(err){ next(err); }
});

/** REST snapshot. The socket carries live updates; this is the fallback. */
router.get('/tables/:id', requireAccount, async (req, res, next) => {
  try {
    const id = oid(req.params.id);
    if(!id) return fail(res, 404, 'NOT_FOUND', 'That table is not available.');
    const allowed = await mayViewTable(id, req.account._id);
    if(!allowed) return fail(res, 403, 'NOT_AT_TABLE', 'You are not seated at that table.');
    const state = engine.stateFor(String(id), String(req.account._id));
    if(!state) return fail(res, 409, 'TABLE_IDLE', 'That table is not running.');
    res.json(state);
  } catch(err){ next(err); }
});

router.post('/tables/:id/action', requireAccount, requireCsrf, async (req, res, next) => {
  try {
    const id = oid(req.params.id);
    if(!id) return fail(res, 404, 'NOT_FOUND', 'That table is not available.');
    const outcome = await engine.act(String(id), String(req.account._id), {
      type: String(req.body?.type || ''), amount: Number(req.body?.amount) || 0,
      actionId: String(req.body?.actionId || ''), version: req.body?.version
    });
    if(!outcome.ok) return fail(res, 409, outcome.code, messageFor(outcome.code));
    res.json({ ok:true, state: engine.stateFor(String(id), String(req.account._id)) });
  } catch(err){ next(err); }
});

router.post('/tables/:id/sit-out', requireAccount, requireCsrf, async (req, res, next) => {
  try {
    const id = oid(req.params.id);
    if(!id) return fail(res, 404, 'NOT_FOUND', 'That table is not available.');
    const outcome = engine.setSitOut(String(id), String(req.account._id), req.body?.sitOut === true);
    if(!outcome.ok) return fail(res, 409, outcome.code, messageFor(outcome.code));
    res.json({ ok:true, status: outcome.status });
  } catch(err){ next(err); }
});

/** Report a player. Advisory only: a human reviews it, nothing is automatic. */
router.post('/report', requireAccount, requireCsrf, async (req, res, next) => {
  try {
    const reported = oid(req.body?.reported);
    if(!reported) return fail(res, 400, 'BAD_REQUEST', 'Choose a player to report.');
    if(String(reported) === String(req.account._id))
      return fail(res, 400, 'BAD_REQUEST', 'You cannot report yourself.');
    const category = ['collusion','abuse','multi_accounting','stalling','other']
      .includes(req.body?.category) ? req.body.category : 'other';
    await PlayerReport.findOneAndUpdate(
      { tournament: oid(req.body?.tournament), reported, reporter: req.account._id },
      { $set:{ table: oid(req.body?.table), category, note: String(req.body?.note || '').slice(0, 1000) },
        $setOnInsert:{ status:'open' } },
      { upsert:true });
    res.status(201).json({ ok:true, message:'Thank you. A moderator will review this.' });
  } catch(err){ next(err); }
});

async function mayViewTable(tableId, userId){
  const seat = await Seat.findOne({ table: tableId, user: userId }).lean();
  return Boolean(seat);
}

/* ------------------------------------------------------------------- demo */

/**
 * Demo play needs no account. It is capped, kept in memory, and cannot pay
 * out; the client is told so on every response.
 */
router.post('/demo', (req, res) => {
  const name = validateDisplayName(req.body?.displayName || 'GUEST');
  res.status(201).json(createDemo({ displayName: name.ok ? name.handle : 'GUEST' }));
});

router.get('/demo/:id', (req, res) => {
  const demo = getDemo(req.params.id);
  if(!demo) return fail(res, 404, 'DEMO_EXPIRED', 'This demo has expired. Start a new one.');
  res.json(demo);
});

router.post('/demo/:id/action', (req, res) => {
  const outcome = actDemo(req.params.id, { type: String(req.body?.type || ''), amount: Number(req.body?.amount) || 0 });
  if(!outcome.ok) return fail(res, outcome.code === 'DEMO_EXPIRED' ? 404 : 409, outcome.code, messageFor(outcome.code));
  res.json(outcome.demo);
});

router.post('/demo/:id/next', (req, res) => {
  const outcome = nextDemoHand(req.params.id);
  if(!outcome.ok && outcome.code !== 'DEMO_FINISHED')
    return fail(res, outcome.code === 'DEMO_EXPIRED' ? 404 : 409, outcome.code, messageFor(outcome.code));
  res.json(outcome.demo);
});

router.delete('/demo/:id', (req, res) => { endDemo(req.params.id); res.json({ ok:true }); });

function messageFor(code){
  return {
    ACCOUNT_REQUIRED:'Create a free account to enter this tournament.',
    EMAIL_NOT_VERIFIED:'Verify your email address before entering.',
    ALREADY_REGISTERED:'You are already registered for this tournament.',
    TOURNAMENT_FULL:'This tournament is full. Watch the lobby in case a seat frees up.',
    DISQUALIFIED:'Your entry to this tournament was withdrawn by a moderator.',
    REGISTRATION_CLOSED:'Registration for this tournament has closed.',
    NO_RULES_VERSION:'The official rules for this tournament are not published yet.',
    RULES_NOT_ACCEPTED:'Please read and accept the official rules to enter.',
    AGE_NOT_CONFIRMED:'Confirm you meet the minimum age to enter.',
    NOT_YOUR_TURN:'It is not your turn to act.',
    NOT_SEATED:'You are not seated at this table.',
    NO_HAND:'There is no hand in progress.',
    TABLE_NOT_FOUND:'That table is not running.',
    TOURNAMENT_PAUSED:'The tournament is paused.',
    STALE_VERSION:'The table moved on. Your view has been refreshed.',
    ILLEGAL_ACTION:'That action is not allowed here.',
    DEMO_EXPIRED:'This demo has expired. Start a new one.',
    DEMO_FINISHED:'Demo complete.',
    HAND_IN_PROGRESS:'Finish the current hand first.',
    ELIMINATED:'You are out of this tournament.'
  }[code] || 'That action could not be completed.';
}

export default router;
