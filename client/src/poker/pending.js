/**
 * One action at a time.
 *
 * A poker action is irreversible, so a double click, a repeated key press or an
 * impatient tap during a slow request must never produce two bets. The guard
 * below is the single place that decides whether an action may be sent, and it
 * carries the pending → accepted / rejected state the table renders.
 */

export const createPending = () => ({ inFlight: null, last: null });

const newId = () =>
  (globalThis.crypto?.randomUUID?.() ??
   `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

/**
 * Ask permission to send. Returns `allowed:false` while another action is in
 * flight; the caller sends nothing rather than queueing a second bet.
 */
export function beginAction(pending, move){
  if(pending.inFlight) return { pending, allowed:false, reason:'IN_FLIGHT' };
  const actionId = move.actionId || newId();
  return {
    pending: { ...pending, inFlight: { ...move, actionId, startedAt: Date.now() }, last: null },
    allowed: true,
    action: { ...move, actionId }
  };
}

/** The server answered. Records the outcome so the button can show it. */
export function settleAction(pending, actionId, outcome){
  if(pending.inFlight?.actionId !== actionId) return pending;   // a stale reply
  return {
    inFlight: null,
    last: { ...pending.inFlight, outcome: outcome.ok ? 'accepted' : 'rejected',
            code: outcome.code || null, at: Date.now() }
  };
}

/**
 * A request that never came back. The action is released so the player is not
 * locked out of their own turn, but it is marked so the interface can say so.
 */
export function timeoutAction(pending, actionId){
  if(pending.inFlight?.actionId !== actionId) return pending;
  return { inFlight: null, last: { ...pending.inFlight, outcome:'rejected', code:'TIMEOUT', at: Date.now() } };
}

export const isPending = pending => Boolean(pending.inFlight);
export const pendingMove = pending => pending.inFlight?.type || null;

/** Retrying the same action reuses its id, so the server treats it as one. */
export const retryId = pending => pending.last?.actionId || null;
