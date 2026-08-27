import { engine } from './runtime.js';
import { roundIsComplete, advanceRound } from './tournamentOps.js';

/**
 * Connects the table runtime to the tournament rules. Kept separate so the
 * runtime never imports the operations that import it.
 */
let wired = false;
export function wirePoker(){
  if(wired) return engine;
  wired = true;
  engine.onTableComplete = async tournamentId => {
    try {
      if(await roundIsComplete(tournamentId)) await advanceRound(tournamentId);
    } catch(err){ console.error('[poker] advancing round failed', err); }
  };
  return engine;
}
