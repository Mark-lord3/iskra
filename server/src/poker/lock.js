import { randomUUID } from 'node:crypto';
import EngineLock from '../models/PokerEngineLock.js';

const KEY = 'engine';
const TTL_MS = 30_000;
const RENEW_MS = 10_000;

/**
 * A lease on the right to drive live tables. Acquired by whichever instance
 * gets there first and renewed while it lives; if the holder dies the lease
 * expires and another instance takes over on its next attempt.
 */
export class EngineLease {
  constructor(){ this.id = randomUUID(); this.held = false; this.timer = null; }

  async acquire(){
    const now = new Date();
    const doc = await EngineLock.findOneAndUpdate(
      { key: KEY, $or:[{ holder: this.id }, { expiresAt: { $lte: now } }] },
      { $set:{ holder: this.id, expiresAt: new Date(now.getTime() + TTL_MS) } },
      { new: true, upsert: false }
    ).catch(() => null);

    if(doc){ this.held = true; return true; }

    // No lock document yet. The unique index makes this race safe: exactly one
    // instance wins the insert and the losers simply try again later.
    try {
      await EngineLock.create({ key: KEY, holder: this.id, expiresAt: new Date(now.getTime() + TTL_MS) });
      this.held = true;
      return true;
    } catch { this.held = false; return false; }
  }

  start(onChange = () => {}){
    const tick = async () => {
      const before = this.held;
      const now = await this.acquire();
      if(before !== now) onChange(now);
    };
    this.timer = setInterval(tick, RENEW_MS);
    this.timer.unref?.();
    return tick();
  }

  async stop(){
    clearInterval(this.timer);
    this.timer = null;
    if(this.held) await EngineLock.deleteOne({ key: KEY, holder: this.id }).catch(() => {});
    this.held = false;
  }
}
