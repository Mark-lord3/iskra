/**
 * Tournament lobby state.
 *
 * The server is the clock and the authority. These helpers only translate what
 * it says into what the page shows, so they are pure and can be tested without
 * a browser: no fetch, no Date.now() baked in, no assumptions about the client
 * being in sync.
 */

/**
 * The offset between this browser and the server, measured when a payload
 * arrives. Every countdown is drawn against the server's clock, so a device
 * with the wrong time still sees the right number.
 */
export function clockOffset(serverTime, receivedAt = Date.now()){
  if(!serverTime) return 0;
  const server = new Date(serverTime).getTime();
  if(!Number.isFinite(server)) return 0;
  return server - receivedAt;
}

export const serverNow = (offset = 0, localNow = Date.now()) => localNow + offset;

/** Milliseconds until `target`, measured on the server's clock. Never negative. */
export function remaining(target, offset = 0, localNow = Date.now()){
  if(!target) return null;
  const at = new Date(target).getTime();
  if(!Number.isFinite(at)) return null;
  return Math.max(0, at - serverNow(offset, localNow));
}

/** Split a duration into the digits a countdown displays. */
export function countdownParts(ms){
  const total = Math.max(0, Math.floor((ms ?? 0) / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    totalSeconds: total
  };
}

export const pad2 = n => String(n).padStart(2, '0');

/**
 * The single status the hero announces. Derived from the tournament's own
 * state, plus how close the clock is — never from anything the browser decides
 * on its own.
 */
export const STATUS_TONES = {
  registration_open:'open', starting_soon:'soon', live:'live',
  paused:'paused', completed:'done', cancelled:'off', scheduled:'soon', draft:'off'
};

export function lobbyStatus(tournament, countdown, offset = 0, localNow = Date.now()){
  const state = tournament?.state;
  if(!state) return { key:'unavailable', tone:'off' };
  if(state === 'cancelled') return { key:'cancelled', tone:'off' };
  if(state === 'voided') return { key:'cancelled', tone:'off' };
  if(state === 'completed') return { key:'completed', tone:'done' };
  if(state === 'paused') return { key:'paused', tone:'paused' };
  if(['round_one','round_two','final_round'].includes(state)) return { key:'live', tone:'live' };

  if(state === 'registration_open'){
    const left = remaining(countdown?.target, offset, localNow);
    // Inside the last fifteen minutes the lobby stops saying "open" and starts
    // saying "closing", because that is the moment that matters.
    if(left != null && left <= 15 * 60_000) return { key:'closing_soon', tone:'soon' };
    return { key:'registration_open', tone:'open' };
  }
  if(state === 'registration_locked') return { key:'starting_soon', tone:'soon' };
  if(state === 'scheduled') return { key:'scheduled', tone:'soon' };
  return { key:'unavailable', tone:'off' };
}

/**
 * The one action the page pushes. Exactly one is primary at a time, and each
 * one is either a real route or a real request — never a placeholder.
 */
export function primaryAction(me, tournament){
  const state = tournament?.state;
  const slug = tournament?.slug;

  if(state === 'completed')
    return { key:'view_results', kind:'link', href:`/play/poker/${slug}/results` };
  if(state === 'cancelled' || state === 'voided')
    return { key:'cancelled', kind:'none', disabled:true };

  if(!me?.signedIn)
    return { key:'sign_in', kind:'link', href:'/account' };

  if(me.canOpenTable && me.seat)
    return { key: me.seat.status === 'active' ? 'join_table' : 'resume_table',
             kind:'link', href:`/play/poker/${slug}/table` };

  if(me.registered){
    if(state === 'registration_open' && me.status === 'registered')
      return { key:'check_in', kind:'action', action:'check-in' };
    if(['round_one','round_two','final_round'].includes(state) && !me.seat)
      return { key:'eliminated', kind:'none', disabled:true };
    return { key:'registered', kind:'none', disabled:true };
  }

  if(state === 'registration_open')
    return tournament.full
      ? { key:'full', kind:'none', disabled:true }
      : { key:'register', kind:'action', action:'register' };

  return { key:'closed', kind:'none', disabled:true };
}

/** How full the field is, for the capacity meter. Uncapped fields still grow. */
export function capacityMeter(field){
  const registered = field?.registered ?? 0;
  const capacity = field?.capacity ?? null;
  if(capacity) return { registered, capacity, percent: Math.min(100, Math.round((registered / capacity) * 100)), capped:true };
  // With no cap, the meter shows progress towards filling the current tables.
  const seats = Math.max(registered, (field?.tables ?? 0) * 9, 9);
  return { registered, capacity:null, percent: Math.min(100, Math.round((registered / seats) * 100)), capped:false };
}

/** Which tournament the lobby should lead with. */
export function featuredTournament(list = []){
  const rank = t => ({
    registration_open:0, registration_locked:1, round_one:2, round_two:2, final_round:2,
    paused:3, scheduled:4, completed:5, cancelled:6
  }[t.state] ?? 7);
  return [...list].sort((a, b) =>
    rank(a) - rank(b) || new Date(a.startsAt) - new Date(b.startsAt))[0] || null;
}
