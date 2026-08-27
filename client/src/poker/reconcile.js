/**
 * Deciding which snapshot is newer.
 *
 * Two sources describe the same table: the socket, which is fast, and the REST
 * snapshot, which is the recovery path. Either can arrive late. Applying an
 * older snapshot would rewind the table in front of the player, so every
 * incoming state is ranked before it is accepted.
 */

/** A snapshot's position in time: later hands beat earlier ones. */
export function stateRank(state){
  if(!state) return [-1, -1];
  const hand = state.handNumber ?? state.handsPlayed ?? 0;
  const version = state.hand?.version ?? -1;
  // A finished hand always ranks above the same hand still in progress.
  const done = state.hand?.street === 'complete' ? 1 : 0;
  return [hand, version, done];
}

export function isNewer(candidate, current){
  if(!candidate) return false;
  if(!current) return true;
  // A different table is not comparable; treat it as a replacement.
  if(candidate.tableId && current.tableId && candidate.tableId !== current.tableId) return true;
  const a = stateRank(candidate), b = stateRank(current);
  for(let i = 0; i < a.length; i++){
    if(a[i] > b[i]) return true;
    if(a[i] < b[i]) return false;
  }
  return false;
}

/** Accept a snapshot only when it moves the table forward. */
export function reconcile(current, incoming){
  if(!incoming) return { state: current, changed: false };
  if(isNewer(incoming, current)) return { state: incoming, changed: true };
  return { state: current, changed: false };
}

/**
 * Whether the gap between two snapshots is too wide to animate step by step —
 * more than one hand, or a long jump in version after a reconnection.
 */
export function isBigJump(prev, next){
  if(!prev || !next) return true;
  const [pHand, pVersion] = stateRank(prev), [nHand, nVersion] = stateRank(next);
  if(nHand - pHand > 1) return true;
  if(nHand === pHand && nVersion - pVersion > 4) return true;
  return false;
}
