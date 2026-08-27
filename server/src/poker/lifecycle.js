import { TOURNAMENT_STATES } from '../models/PokerTournament.js';

/**
 * Tournament lifecycle. Every state change in the product goes through
 * `transition`, so there is exactly one place where the rules live and no
 * route can invent a shortcut.
 */
const TRANSITIONS = {
  draft:                ['scheduled','cancelled'],
  scheduled:            ['registration_open','draft','cancelled'],
  registration_open:    ['registration_locked','paused','cancelled'],
  registration_locked:  ['round_one','paused','cancelled'],
  round_one:            ['round_two','paused','cancelled','voided'],
  round_two:            ['final_round','paused','cancelled','voided'],
  final_round:          ['completed','paused','cancelled','voided'],
  completed:            ['voided'],
  paused:               ['registration_open','registration_locked','round_one','round_two','final_round','cancelled','voided'],
  cancelled:            [],
  voided:               []
};

/* Which state a pause returns to. Stored on the tournament when pausing. */
export const RESUMABLE = ['registration_open','registration_locked','round_one','round_two','final_round'];

export function canTransition(from, to){
  if(!TOURNAMENT_STATES.includes(to)) return { ok:false, code:'UNKNOWN_STATE' };
  const allowed = TRANSITIONS[from] || [];
  if(!allowed.includes(to)) return { ok:false, code:'ILLEGAL_TRANSITION', allowed };
  return { ok:true };
}

/**
 * The publication gate. Moving a tournament out of `draft` is what makes it
 * visible to players, so this is where legal approval is enforced. It is
 * deliberately impossible to satisfy by editing a flag on the tournament
 * alone: an approved rules version and a recorded human reviewer are required.
 */
export function canPublish(tournament, { prizeCount = 0 } = {}){
  const blockers = tournament.publishBlockers(prizeCount);
  return { ok: blockers.length === 0, blockers };
}

export function transition(tournament, to, { prizeCount = 0, now = new Date(), actor = 'system', reason = '' } = {}){
  const step = canTransition(tournament.state, to);
  if(!step.ok) return { ...step, from: tournament.state, to };

  // Publishing is the one transition with an external precondition.
  if(to === 'scheduled' || to === 'registration_open'){
    const gate = canPublish(tournament, { prizeCount });
    if(!gate.ok) return { ok:false, code:'PUBLICATION_BLOCKED', blockers: gate.blockers, from: tournament.state, to };
  }

  const from = tournament.state;
  const patch = { state: to };

  if(to === 'scheduled' && !tournament.publishedAt) patch.publishedAt = now;
  // The structure freezes the moment players can enter, so nobody's entry
  // terms can change underneath them.
  if(to === 'registration_open' && !tournament.structureFrozenAt) patch.structureFrozenAt = now;
  if(to === 'paused' && RESUMABLE.includes(from)) patch.resumeState = from;
  if(to === 'cancelled'){ patch.cancelledAt = now; patch.cancellationReason = reason; }

  return { ok:true, from, to, patch,
    audit:{ type:`state_${to}`, actorType: actor === 'system' ? 'system' : 'admin', actor, reason,
            detail:{ from, to }, at: now } };
}

/** Resuming goes back to where the pause happened, never forward. */
export function resume(tournament){
  if(tournament.state !== 'paused') return { ok:false, code:'NOT_PAUSED' };
  const back = tournament.resumeState;
  if(!RESUMABLE.includes(back)) return { ok:false, code:'NO_RESUME_STATE' };
  return { ok:true, patch:{ state: back, resumeState: null } };
}

/**
 * Registration eligibility, decided entirely server-side. A client cannot
 * assert age, acceptance, or timing.
 */
export function canRegister({ tournament, account, existingRegistration, acceptedRulesVersion, now = new Date() }){
  if(!account) return { ok:false, code:'ACCOUNT_REQUIRED' };
  if(!account.emailVerified) return { ok:false, code:'EMAIL_NOT_VERIFIED' };
  if(existingRegistration) return { ok:false, code:'ALREADY_REGISTERED' };
  if(!tournament.registrationOpen(now)) return { ok:false, code:'REGISTRATION_CLOSED' };
  if(!tournament.rulesVersion) return { ok:false, code:'NO_RULES_VERSION' };
  if(String(acceptedRulesVersion || '') !== String(tournament.rulesVersion))
    return { ok:false, code:'RULES_NOT_ACCEPTED' };
  if(account.ageConfirmed !== true) return { ok:false, code:'AGE_NOT_CONFIRMED' };
  return { ok:true };
}

/**
 * A deterministic idempotency key for prize fulfilment. The same tournament,
 * placement and winner always produce the same key, and the unique index on
 * TournamentPrize.issuanceKey turns a retry into a no-op rather than a second
 * set of tickets.
 */
export function issuanceKey(tournamentId, placement, userId){
  return `prize:${tournamentId}:${placement}:${userId}`;
}

/**
 * Standings → placements. Chip count first, then who survived longest, then a
 * pre-committed random seed. Never a coin flip at award time.
 */
export function rankStandings(players, { seed = '' } = {}){
  return players.slice().sort((a, b) => {
    if(b.finishingChips !== a.finishingChips) return b.finishingChips - a.finishingChips;
    const ae = a.eliminationOrder ?? Infinity, be = b.eliminationOrder ?? Infinity;
    if(be !== ae) return be - ae;                 // eliminated later ranks higher
    return hash(seed + a.userId) - hash(seed + b.userId);
  }).map((p, i) => ({ ...p, placement: i + 1 }));
}

function hash(s){
  let h = 2166136261;
  for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
