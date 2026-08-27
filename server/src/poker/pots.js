/**
 * Pot construction and award.
 *
 * Every chip a player puts in is tracked per player. Pots are then built in
 * layers: each distinct all-in amount closes a layer that only the players who
 * reached it can win. This is what produces correct main and side pots.
 */

/**
 * @param {Array<{seat:number, committed:number, folded:boolean}>} players
 * @returns {Array<{amount:number, eligible:number[]}>} main pot first
 */
export function buildPots(players){
  const contributors = players.filter(p => p.committed > 0);
  if(!contributors.length) return [];

  // Layer boundaries are the distinct amounts people managed to put in.
  const levels = [...new Set(contributors.map(p => p.committed))].sort((a,b) => a - b);

  const pots = [];
  let previous = 0;
  for(const level of levels){
    const slice = level - previous;
    if(slice <= 0){ previous = level; continue; }

    let amount = 0;
    for(const p of contributors) if(p.committed >= level) amount += slice;
    // Dead money from folded players still belongs to this layer.
    for(const p of contributors)
      if(p.committed < level && p.committed > previous) amount += p.committed - previous;

    // Only players who reached this level and are still live may win it.
    const eligible = contributors
      .filter(p => p.committed >= level && !p.folded)
      .map(p => p.seat);

    if(amount > 0) pots.push({ amount, eligible });
    previous = level;
  }

  // Layers with the same eligibility are indistinguishable: merge them.
  const merged = [];
  for(const pot of pots){
    const key = pot.eligible.slice().sort((a,b)=>a-b).join(',');
    const last = merged[merged.length - 1];
    if(last && last.key === key) last.amount += pot.amount;
    else merged.push({ ...pot, key });
  }
  return merged.map(({ amount, eligible }) => ({ amount, eligible }));
}

/**
 * Split one pot between tied winners.
 *
 * Chips are indivisible, so a split can leave a remainder. The odd chips go to
 * the winners closest to the left of the dealer button, which is the standard
 * rule and, importantly, is deterministic and auditable.
 *
 * @param {number[]} winners seat ids sharing the pot
 * @param {number[]} order   seats in order starting left of the button
 */
export function splitPot(amount, winners, order){
  const share = Math.floor(amount / winners.length);
  let remainder = amount - share * winners.length;
  const payouts = new Map(winners.map(s => [s, share]));

  for(const seat of order){
    if(remainder <= 0) break;
    if(payouts.has(seat)){ payouts.set(seat, payouts.get(seat) + 1); remainder--; }
  }
  // Defensive: if the seating order did not cover every winner, fall back to
  // the winner list so no chip is ever destroyed.
  for(const seat of winners){
    if(remainder <= 0) break;
    payouts.set(seat, payouts.get(seat) + 1); remainder--;
  }
  return payouts;
}

/**
 * Award every pot from a finished hand.
 *
 * @param {Array<{amount:number, eligible:number[]}>} pots
 * @param {(seats:number[]) => number[][]} rankSeats groups of tied seats, best first
 * @param {number[]} order seats left of the button onward, for odd chips
 * @returns {{payouts:Map<number,number>, detail:Array}}
 */
export function awardPots(pots, rankSeats, order){
  const payouts = new Map();
  const detail = [];

  for(const pot of pots){
    if(!pot.eligible.length) continue;           // everyone folded into dead money
    const groups = rankSeats(pot.eligible);
    const winners = groups[0] || [];
    if(!winners.length) continue;

    const split = splitPot(pot.amount, winners, order);
    for(const [seat, chips] of split)
      payouts.set(seat, (payouts.get(seat) || 0) + chips);
    detail.push({ amount: pot.amount, eligible: pot.eligible, winners: [...split.keys()],
                  perWinner: Object.fromEntries(split) });
  }
  return { payouts, detail };
}

/** Total chips in play, used by the invariant checks in tests and at runtime. */
export const totalCommitted = players => players.reduce((sum, p) => sum + p.committed, 0);
