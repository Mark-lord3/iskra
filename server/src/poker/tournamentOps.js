import crypto from 'node:crypto';
import Tournament from '../models/PokerTournament.js';
import Round from '../models/TournamentRound.js';
import Table from '../models/PokerTable.js';
import Seat from '../models/PokerSeat.js';
import Registration from '../models/TournamentRegistration.js';
import Result from '../models/TournamentResult.js';
import Prize from '../models/TournamentPrize.js';
import Audit from '../models/TournamentAuditEvent.js';
import { transition, resume as resumeLifecycle, rankStandings } from './lifecycle.js';
import { seatPlayers, advancingPlayers, defaultBlindSchedule } from './structure.js';
import { engine } from './runtime.js';
import { fulfillPrizes } from './fulfillment.js';

const ROUND_ORDER = ['round_one','round_two','final_round'];

export async function audit(tournamentId, entry){
  return Audit.create({ tournament: tournamentId, ...entry });
}

/** Apply a lifecycle transition and record it. One path, always audited. */
export async function move(tournament, to, opts = {}){
  const prizeCount = await Prize.countDocuments({ tournament: tournament._id });
  const step = transition(tournament, to, { prizeCount, ...opts });
  if(!step.ok) return step;
  await Tournament.updateOne({ _id: tournament._id }, { $set: step.patch });
  await audit(tournament._id, step.audit);
  Object.assign(tournament, step.patch);
  return step;
}

/**
 * Seat a round. The draw is shuffled from a recorded seed so the seating can
 * be reproduced and shown to be unrigged, and so nobody can pick their table.
 */
export async function seatRound(tournament, roundName, players){
  const number = ROUND_ORDER.indexOf(roundName) + 1;
  const advancement = roundName === 'final_round'
    ? { rule:'top_n_per_table', value:1 }
    : tournament.advancement?.[roundName === 'round_one' ? 'roundOne' : 'roundTwo'] || { rule:'top_n_per_table', value:2 };

  const round = await Round.findOneAndUpdate(
    { tournament: tournament._id, number },
    { $set:{ name: roundName, status:'seating',
             advancementRule: advancement.rule, advancementValue: advancement.value,
             tieBreak: tournament.advancement?.tieBreak || 'chip_count_then_elimination_order_then_random_seed',
             playerCount: players.length, startedAt: new Date() } },
    { upsert:true, new:true, setDefaultsOnInsert:true });

  const seed = crypto.randomBytes(16).toString('hex');
  const shuffled = deterministicShuffle(players, seed);
  const size = roundName === 'final_round' ? Math.min(tournament.tableSize, Math.max(2, players.length)) : tournament.tableSize;
  const layout = seatPlayers(shuffled, size);

  const created = [];
  for(const plan of layout){
    const tableDoc = await Table.findOneAndUpdate(
      { tournament: tournament._id, round: round._id, label: plan.label },
      { $set:{ size: plan.size, status:'seating', buttonSeat: 0, handNumber: 0,
               isFinalTable: roundName === 'final_round', levelStartedAt: new Date() } },
      { upsert:true, new:true, setDefaultsOnInsert:true });

    for(const s of plan.seats){
      await Seat.findOneAndUpdate(
        { table: tableDoc._id, seatIndex: s.seatIndex },
        { $set:{ tournament: tournament._id, user: s.userId, displayName: s.displayName,
                 stack: s.stack, status:'active' } },
        { upsert:true, new:true, setDefaultsOnInsert:true });
    }
    created.push(tableDoc);
  }

  await Round.updateOne({ _id: round._id }, { $set:{ status:'running', tableCount: created.length } });
  await audit(tournament._id, { type:`round_seated`, actorType:'system',
    detail:{ round: roundName, tables: created.length, players: players.length, seatingSeed: seed } });

  for(const tableDoc of created) await engine.loadTable(tableDoc, tournament, roundName);
  return { round, tables: created };
}

/** A shuffle that can be replayed from its seed. */
function deterministicShuffle(list, seed){
  const out = list.slice();
  let counter = 0;
  const next = () => {
    const h = crypto.createHash('sha256').update(seed).update(String(counter++)).digest();
    return h.readUInt32BE(0) / 2 ** 32;
  };
  for(let i = out.length - 1; i > 0; i--){
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Close registration and deal the first round. */
export async function startTournament(tournamentId, { actor = 'system' } = {}){
  const tournament = await Tournament.findById(tournamentId);
  if(!tournament) return { ok:false, code:'NOT_FOUND' };

  if(tournament.state === 'registration_open'){
    const lock = await move(tournament, 'registration_locked', { actor });
    if(!lock.ok) return lock;
  }
  if(tournament.state !== 'registration_locked') return { ok:false, code:'NOT_READY', state: tournament.state };

  const registrations = await Registration.find({
    tournament: tournamentId, status:{ $in:['registered','checked_in'] } }).lean();
  if(registrations.length < 2) return { ok:false, code:'NOT_ENOUGH_PLAYERS', players: registrations.length };

  const step = await move(tournament, 'round_one', { actor });
  if(!step.ok) return step;

  // Everyone starts with a result row, so a player who never reaches the money
  // still has a finishing record.
  for(const reg of registrations)
    await Result.findOneAndUpdate(
      { tournament: tournamentId, user: reg.user },
      { $setOnInsert:{ displayName: reg.displayName, roundReached:'round_one', finishingChips: tournament.startingStack } },
      { upsert:true });

  await seatRound(tournament, 'round_one', registrations.map(r => ({
    userId: String(r.user), displayName: r.displayName, stack: tournament.startingStack })));

  return { ok:true, players: registrations.length };
}

/**
 * Called when every table in a round has finished. Works out who advances,
 * seats the next round, or finishes the tournament.
 */
export async function advanceRound(tournamentId){
  const tournament = await Tournament.findById(tournamentId);
  if(!tournament) return { ok:false, code:'NOT_FOUND' };
  const current = ROUND_ORDER.indexOf(tournament.state);
  if(current < 0) return { ok:false, code:'NOT_IN_A_ROUND' };

  const round = await Round.findOne({ tournament: tournamentId, number: current + 1 });
  if(!round) return { ok:false, code:'NO_ROUND' };

  const tables = await Table.find({ tournament: tournamentId, round: round._id }).lean();
  const seats = await Seat.find({ table:{ $in: tables.map(t => t._id) } }).lean();
  const seed = String(round._id);

  const grouped = tables.map(t => ({
    id: String(t._id),
    players: seats.filter(s => String(s.table) === String(t._id)).map(s => ({
      userId: String(s.user), displayName: s.displayName, stack: s.stack,
      eliminationOrder: s.eliminationOrder ?? null }))
  }));

  await Round.updateOne({ _id: round._id }, { $set:{ status:'completed', completedAt: new Date() } });

  if(tournament.state === 'final_round') return finishTournament(tournament, grouped, seed);

  const survivors = advancingPlayers(grouped, {
    rule: round.advancementRule, value: round.advancementValue, seed
  }).filter(p => p.stack > 0);

  if(survivors.length < 2) return finishTournament(tournament, grouped, seed);

  const next = ROUND_ORDER[current + 1];
  const step = await move(tournament, next, {});
  if(!step.ok) return step;

  for(const player of survivors)
    await Result.updateOne({ tournament: tournamentId, user: player.userId },
      { $set:{ roundReached: next, finishingChips: player.stack } });

  await seatRound(tournament, next, survivors.map(p => ({
    userId: p.userId, displayName: p.displayName, stack: p.stack })));

  return { ok:true, advanced: survivors.length, round: next };
}

/** Final standings, then prize fulfilment. */
export async function finishTournament(tournament, grouped, seed){
  const finalPlayers = grouped.flatMap(g => g.players);
  const all = await Result.find({ tournament: tournament._id }).lean();

  const merged = all.map(r => {
    const live = finalPlayers.find(p => p.userId === String(r.user));
    return {
      userId: String(r.user), displayName: r.displayName,
      finishingChips: live ? live.stack : (r.finishingChips && !r.eliminatedAt ? r.finishingChips : 0),
      eliminationOrder: r.eliminationOrder ?? null
    };
  });

  const ranked = rankStandings(merged, { seed });
  for(const player of ranked)
    await Result.updateOne({ tournament: tournament._id, user: player.userId },
      { $set:{ placement: player.placement, finishingChips: player.finishingChips,
               prizeStatus: player.placement <= 3 ? 'pending' : 'none' } });

  const step = await move(tournament, 'completed', {});
  if(!step.ok) return step;

  engine.dropTournament(tournament._id);
  const prizes = await fulfillPrizes(tournament._id);
  return { ok:true, placements: ranked.slice(0, 3), prizes };
}

/**
 * Has the current round finished? Every table is done when no table still has
 * two funded players.
 */
export async function roundIsComplete(tournamentId){
  const current = ROUND_ORDER.indexOf((await Tournament.findById(tournamentId).lean())?.state);
  if(current < 0) return false;
  const round = await Round.findOne({ tournament: tournamentId, number: current + 1 }).lean();
  if(!round) return false;
  const tables = await Table.find({ tournament: tournamentId, round: round._id }).lean();
  if(!tables.length) return false;
  return tables.every(t => t.status === 'completed');
}

export async function pauseTournament(tournamentId, { actor, reason = '' } = {}){
  const tournament = await Tournament.findById(tournamentId);
  if(!tournament) return { ok:false, code:'NOT_FOUND' };
  const step = await move(tournament, 'paused', { actor, reason });
  if(step.ok) engine.pauseTournament(tournamentId);
  return step;
}

export async function resumeTournament(tournamentId, { actor } = {}){
  const tournament = await Tournament.findById(tournamentId);
  if(!tournament) return { ok:false, code:'NOT_FOUND' };
  const back = resumeLifecycle(tournament);
  if(!back.ok) return back;
  await Tournament.updateOne({ _id: tournament._id }, { $set: back.patch });
  await audit(tournament._id, { type:'state_resumed', actorType:'admin', actor, detail: back.patch });
  engine.resumeTournament(tournamentId);
  return { ok:true, state: back.patch.state };
}

export async function cancelTournament(tournamentId, { actor, reason = '' } = {}){
  const tournament = await Tournament.findById(tournamentId);
  if(!tournament) return { ok:false, code:'NOT_FOUND' };
  const step = await move(tournament, 'cancelled', { actor, reason });
  if(step.ok){
    engine.dropTournament(tournamentId);
    await Table.updateMany({ tournament: tournamentId, status:{ $ne:'completed' } }, { $set:{ status:'completed' } });
  }
  return step;
}

export { ROUND_ORDER };
