import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import Tournament from '../models/PokerTournament.js';
import Round from '../models/TournamentRound.js';
import Table from '../models/PokerTable.js';
import Seat from '../models/PokerSeat.js';
import Hand from '../models/PokerHand.js';
import Action from '../models/PokerAction.js';
import Result from '../models/TournamentResult.js';
import Audit from '../models/TournamentAuditEvent.js';
import Registration from '../models/TournamentRegistration.js';
import { createHand, applyAction, legalActions, viewFor } from './hand.js';
import { levelAt, msUntilNextLevel, seatPlayers, balanceMoves, shouldBreakTable,
         advancingPlayers, defaultBlindSchedule } from './structure.js';
import { EngineLease } from './lock.js';

const TICK_MS = 1000;
const SHOWDOWN_PAUSE_MS = 4500;   // time to read the result before the next deal
const UNCONTESTED_PAUSE_MS = 2000;
const ROUND_NAMES = ['round_one','round_two','final_round'];

const now = () => Date.now();

/**
 * Drives every live table: deals hands, runs the action clock, raises blinds,
 * balances tables and advances rounds. All of it is server-side; the client
 * only ever sends an intent and receives a view it is allowed to see.
 */
export class PokerEngine {
  constructor({ broadcast = () => {} } = {}){
    this.tables = new Map();       // tableId -> live table state
    this.broadcast = broadcast;
    this.lease = new EngineLease();
    this.timer = null;
    this.driving = false;
    // Set by the wiring module. Kept as a hook so the runtime never has to
    // import the tournament operations that import it back.
    this.onTableComplete = async () => {};
  }

  /* ------------------------------------------------------------- lifecycle */

  async start(){
    await this.lease.start(held => {
      this.driving = held;
      if(held) this.recover().catch(err => console.error('[poker] recovery failed', err));
    });
    this.driving = this.lease.held;
    if(this.driving) await this.recover();
    this.timer = setInterval(() => { this.tick().catch(err => console.error('[poker] tick', err)); }, TICK_MS);
    this.timer.unref?.();
  }

  async stop(){
    clearInterval(this.timer);
    this.timer = null;
    for(const table of this.tables.values()) await this.persistTable(table).catch(() => {});
    await this.lease.stop();
  }

  /** Rebuild memory from the database after a restart or a failover. */
  async recover(){
    const live = await Table.find({ status:{ $in:['seating','running','balancing'] } }).lean();
    for(const doc of live){
      if(this.tables.has(String(doc._id))) continue;
      const tournament = await Tournament.findById(doc.tournament).lean();
      if(!tournament || !['round_one','round_two','final_round'].includes(tournament.state)) continue;
      const seats = await Seat.find({ table: doc._id }).lean();
      const open = await Hand.findOne({ table: doc._id, completedAt: null })
        .select('+state +shuffleSeed').sort({ handNumber:-1 });

      this.tables.set(String(doc._id), {
        id: String(doc._id),
        tournamentId: String(doc.tournament),
        roundId: String(doc.round),
        size: doc.size,
        buttonSeat: doc.buttonSeat,
        handNumber: doc.handNumber,
        blindSchedule: tournament.blindSchedule?.length ? tournament.blindSchedule : defaultBlindSchedule(),
        levelStartedAt: doc.levelStartedAt ? new Date(doc.levelStartedAt).getTime() : now(),
        actionTimerSeconds: tournament.actionTimerSeconds,
        timeBankSeconds: tournament.timeBankSeconds,
        seats: new Map(seats.map(s => [s.seatIndex, {
          seatIndex: s.seatIndex, userId: String(s.user), displayName: s.displayName,
          stack: s.stack, status: s.status, connected: false,
          timeBankMs: (tournament.timeBankSeconds || 0) * 1000,
          eliminationOrder: s.eliminationOrder ?? null
        }])),
        hand: open?.state || null,
        handDocId: open ? String(open._id) : null,
        actDeadline: null,
        nextHandAt: open ? null : now() + 1500,
        paused: false
      });
    }
  }

  /* ------------------------------------------------------------------ tick */

  async tick(){
    if(!this.driving) return;
    for(const table of [...this.tables.values()]){
      try { await this.tickTable(table); }
      catch(err){ console.error('[poker] table', table.id, err); }
    }
  }

  async tickTable(table){
    if(table.paused) return;
    this.syncBlindLevel(table);

    if(table.hand && table.hand.street !== 'complete'){
      if(table.actDeadline && now() >= table.actDeadline) await this.forceAction(table);
      return;
    }
    if(table.hand && table.hand.street === 'complete' && table.nextHandAt == null)
      table.nextHandAt = now() + (table.hand.result?.uncontested ? UNCONTESTED_PAUSE_MS : SHOWDOWN_PAUSE_MS);

    if(table.nextHandAt != null && now() >= table.nextHandAt){
      // Balancing happens between hands, never mid-hand.
      await this.balanceRound(table.tournamentId, table.roundId);
      if(!this.tables.has(table.id)) return;   // this table was broken up
      await this.startHand(table);
    }
  }

  /**
   * Keep table sizes within one player of each other, and break a table up
   * once the remaining field no longer needs it. Only tables that are between
   * hands can give or receive a player.
   */
  async balanceRound(tournamentId, roundId){
    const inRound = this.liveTablesFor(tournamentId).filter(t => t.roundId === String(roundId));
    if(inRound.length < 2) return;
    if(inRound.some(t => t.hand && t.hand.street !== 'complete')) return;   // wait for the round to be idle

    const summary = inRound.map(t => ({ id: t.id, size: t.size, activeCount: this.fundedSeats(t).length }));

    const breakId = shouldBreakTable(summary, inRound[0].size);
    if(breakId){
      const source = this.tables.get(breakId);
      const targets = summary.filter(t => t.id !== breakId).sort((a, b) => a.activeCount - b.activeCount);
      for(const player of this.fundedSeats(source)){
        const target = targets.sort((a, b) => a.activeCount - b.activeCount)[0];
        if(!target || target.activeCount >= target.size) break;
        await this.movePlayer(source, this.tables.get(target.id), player);
        target.activeCount += 1;
      }
      await this.finishTable(source);
      return;
    }

    for(const mv of balanceMoves(summary)){
      const from = this.tables.get(mv.from), to = this.tables.get(mv.to);
      if(!from || !to) continue;
      // Move the player about to pay the big blind, the standard fair choice.
      const candidates = this.fundedSeats(from).sort((a, b) => a.seatIndex - b.seatIndex);
      const player = candidates.find(s => s.seatIndex > from.buttonSeat) || candidates[0];
      if(player) await this.movePlayer(from, to, player);
    }
  }

  /** Move one player, with their stack, to an open seat at another table. */
  async movePlayer(from, to, player){
    const taken = new Set([...to.seats.values()].filter(s => s.status !== 'moved' && s.status !== 'eliminated').map(s => s.seatIndex));
    let seatIndex = 0;
    while(taken.has(seatIndex) && seatIndex < to.size) seatIndex += 1;
    if(seatIndex >= to.size) return false;

    player.status = 'moved';
    await Seat.updateOne({ table: from.id, seatIndex: player.seatIndex }, { $set:{ status:'moved' } });
    from.seats.delete(player.seatIndex);

    await Seat.findOneAndUpdate(
      { table: to.id, seatIndex },
      { $set:{ tournament: to.tournamentId, user: player.userId, displayName: player.displayName,
               stack: player.stack, status:'active' } },
      { upsert:true, setDefaultsOnInsert:true });

    to.seats.set(seatIndex, { ...player, seatIndex, status:'active', connected:false });
    this.publish(from, 'player_moved', { displayName: player.displayName, to: to.id });
    this.publish(to, 'player_arrived', { displayName: player.displayName, seatIndex });
    return true;
  }

  syncBlindLevel(table){
    const level = levelAt(table.blindSchedule, now() - table.levelStartedAt);
    if(level.level !== table.blindLevel){
      table.blindLevel = level.level;
      table.level = level;
      this.publish(table, 'level');
      Table.updateOne({ _id: table.id }, { $set:{ blindLevel: level.level } }).catch(() => {});
    }
    if(!table.level) table.level = level;
  }

  /* ------------------------------------------------------------------ hands */

  fundedSeats(table){
    return [...table.seats.values()].filter(s => s.stack > 0 && s.status !== 'eliminated' && s.status !== 'moved');
  }

  async startHand(table){
    table.nextHandAt = null;
    await this.settleEliminations(table);

    const funded = this.fundedSeats(table);
    if(funded.length < 2){ await this.finishTable(table); return; }

    const level = table.level || levelAt(table.blindSchedule, 0);
    if(level.isBreak){ table.nextHandAt = now() + 5000; return; }   // no cards during a break

    table.buttonSeat = this.nextButton(table, funded);
    table.handNumber += 1;

    const hand = createHand({
      seats: funded.map(s => ({ seat: s.seatIndex, playerId: s.userId, stack: s.stack, sittingOut: s.status === 'sitting_out' })),
      buttonSeat: table.buttonSeat,
      smallBlind: level.smallBlind, bigBlind: level.bigBlind, ante: level.ante || 0,
      handId: randomUUID()
    });

    const doc = await Hand.create({
      table: table.id, tournament: table.tournamentId, handNumber: table.handNumber,
      buttonSeat: table.buttonSeat, smallBlind: level.smallBlind, bigBlind: level.bigBlind,
      ante: level.ante || 0, shuffleCommitment: hand.shuffleCommitment,
      street: hand.street, version: hand.version, state: hand
    });

    table.hand = hand;
    table.handDocId = String(doc._id);
    this.armClock(table);
    await Table.updateOne({ _id: table.id }, { $set:{ buttonSeat: table.buttonSeat, handNumber: table.handNumber, status:'running' } });
    this.publish(table, 'hand');
  }

  /** The button moves to the next funded seat, skipping the busted. */
  nextButton(table, funded){
    const order = funded.map(s => s.seatIndex).sort((a,b) => a - b);
    const after = order.find(s => s > table.buttonSeat);
    return after ?? order[0];
  }

  armClock(table){
    const hand = table.hand;
    if(!hand || hand.actor == null){ table.actDeadline = null; return; }
    const seat = table.seats.get(hand.actor);
    const base = (table.actionTimerSeconds || 30) * 1000;
    // A player who is away does not hold the table up for the full clock.
    const away = !seat || seat.status === 'sitting_out' || (!seat.connected && seat.status === 'disconnected');
    table.actDeadline = now() + (away ? 3000 : base);
    table.usingTimeBank = false;
  }

  /**
   * The clock ran out. A player with time bank left spends it first; otherwise
   * the free action is taken — check when it costs nothing, fold when it does.
   */
  async forceAction(table){
    const hand = table.hand;
    if(!hand || hand.actor == null) return;
    const seatIndex = hand.actor;
    const seat = table.seats.get(seatIndex);
    const away = !seat || seat.status === 'sitting_out' || !seat.connected;

    if(seat && !away && !table.usingTimeBank && seat.timeBankMs > 0){
      const spend = Math.min(seat.timeBankMs, 15_000);
      seat.timeBankMs -= spend;
      table.usingTimeBank = true;
      table.actDeadline = now() + spend;
      this.publish(table, 'timebank');
      return;
    }

    const legal = legalActions(hand, seatIndex).map(a => a.type);
    const type = legal.includes('check') ? 'check' : 'fold';
    await this.applyAndPersist(table, { seat: seatIndex, type, actionId: `timeout:${hand.handId}:${hand.version}` }, 'timeout');
  }

  /* ----------------------------------------------------------- player input */

  /** A player's action. Everything is re-checked here; the client is not trusted. */
  async act(tableId, userId, move){
    const table = this.tables.get(String(tableId));
    if(!table) return { ok:false, code:'TABLE_NOT_FOUND' };
    if(table.paused) return { ok:false, code:'TOURNAMENT_PAUSED' };
    const hand = table.hand;
    if(!hand || hand.street === 'complete') return { ok:false, code:'NO_HAND' };

    const seat = [...table.seats.values()].find(s => s.userId === String(userId));
    if(!seat) return { ok:false, code:'NOT_SEATED' };
    if(hand.actor !== seat.seatIndex) return { ok:false, code:'NOT_YOUR_TURN' };

    return this.applyAndPersist(table, {
      seat: seat.seatIndex, type: move.type, amount: move.amount,
      actionId: move.actionId || randomUUID(), version: move.version
    }, 'player');
  }

  async applyAndPersist(table, move, source){
    const hand = table.hand;
    const before = hand.version;
    const outcome = applyAction(hand, move);
    if(!outcome.ok) return outcome;

    if(!outcome.duplicate){
      const logged = hand.actionLog[hand.actionLog.length - 1] || {};
      // The unique (hand, actionId) index makes a retry a no-op rather than a
      // second bet, so a duplicate key here is success, not failure.
      await Action.create({
        hand: table.handDocId, table: table.id, seatIndex: move.seat,
        user: table.seats.get(move.seat)?.userId || null,
        street: logged.street || hand.street, type: logged.type || move.type,
        amount: logged.amount || 0, toAmount: logged.to ?? null,
        handVersion: before, actionId: move.actionId, source
      }).catch(err => { if(err?.code !== 11000) throw err; });
    }

    for(const [seatIndex, seatState] of table.seats)
      if(hand.seats[seatIndex]) seatState.stack = hand.seats[seatIndex].stack;

    if(hand.street === 'complete') await this.closeHand(table);
    else this.armClock(table);

    await this.persistHand(table);
    this.publish(table, 'action');
    return { ok:true, version: hand.version };
  }

  async persistHand(table){
    if(!table.handDocId || !table.hand) return;
    const hand = table.hand;
    const complete = hand.street === 'complete';
    await Hand.updateOne({ _id: table.handDocId }, { $set:{
      street: hand.street, version: hand.version, board: hand.board,
      state: complete ? null : hand,
      pots: hand.pots || [], payouts: hand.payouts || null,
      showdown: hand.result?.showdown || [],
      // The seed is only revealed once the hand is over, so nobody — including
      // an administrator — can read undealt cards mid-hand.
      ...(complete ? { shuffleSeed: hand.shuffleSeed, completedAt: new Date() } : {})
    } });
  }

  async closeHand(table){
    table.actDeadline = null;
    table.nextHandAt = now() + (table.hand.result?.uncontested ? UNCONTESTED_PAUSE_MS : SHOWDOWN_PAUSE_MS);
    await Promise.all([...table.seats.values()].map(seat =>
      Seat.updateOne({ table: table.id, seatIndex: seat.seatIndex }, { $set:{ stack: seat.stack } })));
  }

  /* ------------------------------------------------------- eliminations etc */

  async settleEliminations(table){
    const busted = [...table.seats.values()].filter(s => s.stack <= 0 && s.status !== 'eliminated' && s.status !== 'moved');
    if(!busted.length) return;

    for(const seat of busted){
      const order = await this.nextEliminationOrder(table.tournamentId);
      seat.status = 'eliminated';
      seat.eliminationOrder = order;
      await Seat.updateOne({ table: table.id, seatIndex: seat.seatIndex },
        { $set:{ status:'eliminated', eliminatedAt: new Date(), eliminationOrder: order, stack: 0 } });
      await Result.updateOne(
        { tournament: table.tournamentId, user: seat.userId },
        { $set:{ displayName: seat.displayName, eliminationOrder: order, finishingChips: 0,
                 eliminatedAt: new Date() }, $setOnInsert:{ roundReached: table.roundName || 'round_one' } },
        { upsert: true });
      this.publish(table, 'eliminated', { seat: seat.seatIndex, displayName: seat.displayName });
    }
  }

  /** Elimination order counts up from the first player out. */
  async nextEliminationOrder(tournamentId){
    const count = await Seat.countDocuments({ tournament: tournamentId, eliminationOrder: { $ne: null } });
    return count + 1;
  }

  async finishTable(table){
    await Table.updateOne({ _id: table.id }, { $set:{ status:'completed' } });
    table.hand = null;
    table.nextHandAt = null;
    this.publish(table, 'table_complete');
    this.tables.delete(table.id);
    await this.onTableComplete(table.tournamentId, table.roundId).catch?.(() => {});
  }

  /* ------------------------------------------------------------- presence */

  setPresence(tableId, userId, connected){
    const table = this.tables.get(String(tableId));
    if(!table) return;
    const seat = [...table.seats.values()].find(s => s.userId === String(userId));
    if(!seat) return;
    seat.connected = connected;
    if(!connected && seat.status === 'active') seat.status = 'disconnected';
    if(connected && seat.status === 'disconnected') seat.status = 'active';
    seat.lastSeenAt = new Date();
    Seat.updateOne({ table: table.id, seatIndex: seat.seatIndex },
      { $set:{ status: seat.status, lastSeenAt: seat.lastSeenAt } }).catch(() => {});
    this.publish(table, 'presence');
  }

  setSitOut(tableId, userId, sitOut){
    const table = this.tables.get(String(tableId));
    if(!table) return { ok:false, code:'TABLE_NOT_FOUND' };
    const seat = [...table.seats.values()].find(s => s.userId === String(userId));
    if(!seat) return { ok:false, code:'NOT_SEATED' };
    if(seat.status === 'eliminated') return { ok:false, code:'ELIMINATED' };
    seat.status = sitOut ? 'sitting_out' : 'active';
    Seat.updateOne({ table: table.id, seatIndex: seat.seatIndex }, { $set:{ status: seat.status } }).catch(() => {});
    this.publish(table, 'presence');
    return { ok:true, status: seat.status };
  }

  /* ----------------------------------------------------------------- views */

  /** The snapshot one viewer is allowed to see. Spectators get no hole cards. */
  stateFor(tableId, userId){
    const table = this.tables.get(String(tableId));
    if(!table) return null;
    const seat = userId ? [...table.seats.values()].find(s => s.userId === String(userId)) : null;
    const level = table.level || levelAt(table.blindSchedule, now() - table.levelStartedAt);

    return {
      tableId: table.id,
      tournamentId: table.tournamentId,
      handNumber: table.handNumber,
      mySeat: seat ? seat.seatIndex : null,
      level: { level: level.level, smallBlind: level.smallBlind, bigBlind: level.bigBlind,
               ante: level.ante || 0, isBreak: !!level.isBreak,
               msRemaining: msUntilNextLevel(table.blindSchedule, now() - table.levelStartedAt) },
      actDeadline: table.actDeadline,
      actionTimerSeconds: table.actionTimerSeconds,
      paused: table.paused,
      seats: [...table.seats.values()].map(s => ({
        seatIndex: s.seatIndex, displayName: s.displayName, stack: s.stack,
        status: s.status, connected: s.connected,
        timeBankMs: s.seatIndex === seat?.seatIndex ? s.timeBankMs : undefined,
        isMe: s.seatIndex === seat?.seatIndex
      })),
      hand: table.hand ? viewFor(table.hand, seat ? seat.seatIndex : -1) : null
    };
  }

  publish(table, event, detail = {}){
    this.broadcast(table.id, { event, detail });
  }

  /* --------------------------------------------------- tournament controls */

  pauseTournament(tournamentId){
    for(const table of this.tables.values())
      if(table.tournamentId === String(tournamentId)){ table.paused = true; this.publish(table, 'paused'); }
  }

  resumeTournament(tournamentId){
    for(const table of this.tables.values())
      if(table.tournamentId === String(tournamentId)){
        table.paused = false;
        // The clock restarts rather than resuming mid-countdown, so nobody
        // loses time to the pause.
        if(table.hand && table.hand.actor != null) this.armClock(table);
        this.publish(table, 'resumed');
      }
  }

  dropTournament(tournamentId){
    for(const [id, table] of [...this.tables])
      if(table.tournamentId === String(tournamentId)) this.tables.delete(id);
  }

  async persistTable(table){
    await this.persistHand(table).catch(() => {});
    await Promise.all([...table.seats.values()].map(seat =>
      Seat.updateOne({ table: table.id, seatIndex: seat.seatIndex }, { $set:{ stack: seat.stack, status: seat.status } })));
  }

  /** Load a freshly seated table into memory so the tick loop starts dealing. */
  async loadTable(tableDoc, tournament, roundName){
    const seats = await Seat.find({ table: tableDoc._id }).lean();
    const table = {
      id: String(tableDoc._id),
      tournamentId: String(tournament._id),
      roundId: String(tableDoc.round),
      roundName,
      size: tableDoc.size,
      buttonSeat: tableDoc.buttonSeat ?? 0,
      handNumber: tableDoc.handNumber || 0,
      blindSchedule: tournament.blindSchedule?.length ? tournament.blindSchedule : defaultBlindSchedule(),
      levelStartedAt: now(),
      actionTimerSeconds: tournament.actionTimerSeconds,
      timeBankSeconds: tournament.timeBankSeconds,
      seats: new Map(seats.map(s => [s.seatIndex, {
        seatIndex: s.seatIndex, userId: String(s.user), displayName: s.displayName,
        stack: s.stack, status: s.status, connected: false,
        timeBankMs: (tournament.timeBankSeconds || 0) * 1000,
        eliminationOrder: s.eliminationOrder ?? null
      }])),
      hand: null, handDocId: null, actDeadline: null,
      nextHandAt: now() + 6000,   // a moment for players to load the table
      paused: false
    };
    this.tables.set(table.id, table);
    await Table.updateOne({ _id: tableDoc._id }, { $set:{ status:'running', levelStartedAt: new Date() } });
    return table;
  }

  liveTablesFor(tournamentId){
    return [...this.tables.values()].filter(t => t.tournamentId === String(tournamentId));
  }
}

export const engine = new PokerEngine();
