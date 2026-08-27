/**
 * Tournament structure helpers: blind schedules, seating, table balancing and
 * advancement. Kept pure so every rule here can be tested without a database.
 */

/** A sane default ladder. Levels are minutes long; breaks carry no blinds. */
export function defaultBlindSchedule(){
  const levels = [
    [25, 50, 0], [50, 100, 0], [75, 150, 0], [100, 200, 25],
    [150, 300, 50], [200, 400, 50], [300, 600, 75], [400, 800, 100],
    [600, 1200, 150], [800, 1600, 200], [1200, 2400, 300], [1600, 3200, 400]
  ];
  const out = [];
  levels.forEach(([smallBlind, bigBlind, ante], i) => {
    out.push({ level: out.length + 1, smallBlind, bigBlind, ante, durationMinutes: 10, isBreak: false });
    if(i === 3 || i === 7) // a short break every four levels
      out.push({ level: out.length + 1, smallBlind, bigBlind, ante, durationMinutes: 5, isBreak: true });
  });
  return out;
}

/** Which level is live after `elapsedMs` of play. The last level never expires. */
export function levelAt(schedule, elapsedMs){
  let acc = 0;
  for(const level of schedule){
    acc += level.durationMinutes * 60_000;
    if(elapsedMs < acc) return level;
  }
  return schedule[schedule.length - 1];
}

export function msUntilNextLevel(schedule, elapsedMs){
  let acc = 0;
  for(const level of schedule){
    acc += level.durationMinutes * 60_000;
    if(elapsedMs < acc) return acc - elapsedMs;
  }
  return Infinity;
}

/**
 * How many tables a field needs, and how many players sit at each.
 * Sizes differ by at most one so no table is left short-handed.
 */
export function planTables(playerCount, tableSize){
  if(playerCount <= 0) return [];
  if(playerCount <= tableSize) return [playerCount];
  const count = Math.ceil(playerCount / tableSize);
  const base = Math.floor(playerCount / count);
  const extra = playerCount % count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * Assign players to tables. Seats are drawn from a shuffled order so nobody
 * can arrange to sit beside an accomplice, and the caller supplies the
 * shuffled list so the draw is reproducible from a recorded seed.
 */
export function seatPlayers(shuffledPlayers, tableSize){
  const plan = planTables(shuffledPlayers.length, tableSize);
  const tables = plan.map(() => []);
  // Deal round-robin so tables fill evenly rather than front-loading table 1.
  shuffledPlayers.forEach((player, i) => { tables[i % tables.length].push(player); });
  return tables.map((players, index) => ({
    label: `Table ${index + 1}`,
    size: tableSize,
    seats: players.map((player, seatIndex) => ({ ...player, seatIndex }))
  }));
}

/**
 * Table balancing. When counts drift by more than one, the biggest table gives
 * a player to the smallest. Returns the moves to apply, never mutating input.
 */
export function balanceMoves(tables){
  const live = tables
    .map(t => ({ id:t.id, count:t.activeCount, openSeats:t.size - t.activeCount }))
    .filter(t => t.count > 0);
  if(live.length < 2) return [];

  const moves = [];
  const counts = new Map(live.map(t => [t.id, t.count]));
  for(let guard = 0; guard < 50; guard++){
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
    const [bigId, bigCount] = sorted[0];
    const [smallId, smallCount] = sorted[sorted.length - 1];
    if(bigCount - smallCount < 2) break;
    moves.push({ from: bigId, to: smallId });
    counts.set(bigId, bigCount - 1);
    counts.set(smallId, smallCount + 1);
  }
  return moves;
}

/**
 * A table breaks when the round has more tables than the remaining field
 * needs. Its players are spread over the tables with open seats.
 */
export function shouldBreakTable(tables, tableSize){
  const total = tables.reduce((sum, t) => sum + t.activeCount, 0);
  const needed = Math.max(1, Math.ceil(total / tableSize));
  if(tables.length <= needed) return null;
  const candidates = tables.filter(t => t.activeCount > 0)
    .sort((a, b) => a.activeCount - b.activeCount || String(a.id).localeCompare(String(b.id)));
  return candidates[0]?.id ?? null;
}

/**
 * Who advances out of a round. `top_n_per_table` keeps the best N at every
 * table; `top_percent` keeps a share of the whole field. Ties are broken by
 * chips, then by surviving longer, and finally by the committed seed.
 */
export function advancingPlayers(tables, { rule, value, seed = '' }){
  const byChips = list => list.slice().sort((a, b) =>
    b.stack - a.stack ||
    (b.eliminationOrder ?? Infinity) - (a.eliminationOrder ?? Infinity) ||
    hash(seed + a.userId) - hash(seed + b.userId));

  if(rule === 'top_percent'){
    const all = byChips(tables.flatMap(t => t.players));
    const keep = Math.max(1, Math.round(all.length * (value / 100)));
    return all.slice(0, keep);
  }
  return tables.flatMap(t => byChips(t.players).slice(0, Math.max(1, value)));
}

function hash(s){
  let h = 2166136261;
  for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
