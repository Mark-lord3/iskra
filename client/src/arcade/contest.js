/**
 * Spark Rush competition state.
 *
 * The server owns the contest: its window, its participant count, its minimum
 * and whether results are final. These helpers only translate that into what
 * the arcade shows, so they stay pure and testable — and so the page can never
 * decide on its own that play is allowed.
 */

/** How close to closing before the badge starts urging. */
export const CLOSING_SOON_MS = 24 * 3600_000;

export const BADGE_TONES = {
  open:'open', closing_soon:'soon', awaiting_minimum:'wait',
  closed:'closed', finalized:'final', none:'closed'
};

/**
 * The single badge the hero shows. Mirrors the server's status rather than
 * re-deriving it, except for the "closing soon" nuance which is purely a
 * presentation of how much time is left.
 */
export function contestBadge(contest, now = Date.now()){
  if(!contest) return { key:'none', tone:'closed' };
  const { status } = contest;

  if(status === 'finalized') return { key:'finalized', tone:'final' };
  if(status === 'finalizing') return { key:'closed', tone:'closed' };
  if(status === 'closed_pending'){
    const short = (contest.entriesNeeded ?? 0) > 0;
    return short ? { key:'awaiting_minimum', tone:'wait' } : { key:'closed', tone:'closed' };
  }
  if(status === 'open'){
    const left = msUntilClose(contest, now);
    if(left != null && left <= CLOSING_SOON_MS) return { key:'closing_soon', tone:'soon' };
    return { key:'open', tone:'open' };
  }
  return { key:'none', tone:'closed' };
}

export function msUntilClose(contest, now = Date.now()){
  if(!contest?.closesAt) return null;
  const at = new Date(contest.closesAt).getTime();
  if(!Number.isFinite(at)) return null;
  return Math.max(0, at - now);
}

/**
 * Whether the arcade may be started. A closed competition never yields true,
 * whatever the browser thinks about attempts.
 */
export function canPlay(contest, attemptsLeft, screen){
  if(contest?.status !== 'open') return false;
  if(!(attemptsLeft > 0)) return false;
  return !['playing','submitting','loading'].includes(screen);
}

/** Whether a registration form should be offered at all. */
export const canRegister = contest => contest?.status === 'open';

/** The energy-chamber meter. Never divides by zero, never exceeds full. */
export function participantMeter(contest){
  const count = Math.max(0, contest?.participantCount ?? 0);
  const min = Math.max(1, contest?.minParticipants ?? 1);
  return {
    count, min,
    needed: Math.max(0, contest?.entriesNeeded ?? Math.max(0, min - count)),
    percent: Math.min(100, Math.round((count / min) * 100)),
    reached: count >= min
  };
}

/** Split a duration into countdown digits. */
export function countdownParts(ms){
  const total = Math.max(0, Math.floor((ms ?? 0) / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60
  };
}

/**
 * Which reward a provisional rank currently sits in. Mirrors the server's
 * prizeForRank so the page never promises a tier the server would not give.
 */
export function rewardZone(rank){
  if(!rank || rank < 1) return null;
  if(rank === 1) return 'top1';
  if(rank === 2) return 'top2';
  if(rank <= 5) return 'top5';
  return 'played';
}

export const LADDER = [
  { key:'top1',   rank:'1' },
  { key:'top2',   rank:'2' },
  { key:'top5',   rank:'3–5' },
  { key:'played', rank:'*' }
];

/** What the closed panel should say, and what it should offer. */
export function closedState(contest, hasReward){
  if(!contest) return { key:'no_event', action:null };
  if(contest.status === 'finalized')
    return { key: hasReward ? 'finalized_reward' : 'finalized', action:'final_board' };
  if(contest.status === 'finalizing') return { key:'finalizing', action:'final_board' };
  if(contest.status === 'closed_pending')
    return (contest.entriesNeeded ?? 0) > 0
      ? { key:'awaiting_minimum', action:'next_competition' }
      : { key:'finalizing', action:'final_board' };
  return { key:'closed', action:'final_board' };
}
