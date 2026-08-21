import 'dotenv/config';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { connectDB } from './db.js';
import Event from './models/Event.js';
import PromoCode from './models/PromoCode.js';
import Player from './models/Player.js';

/* Times are the venue's wall clock, written as UTC so every visitor sees the
   same door time instead of one shifted into their own timezone. */
const EVENTS = [
  { slug:'project-iskra-grand-opening', date:'2026-08-28T23:00:00Z', title:'Project ISKRA Grand Opening',
    support:'DJ MLNK, Slavic Music', room:'Muzique Nightclub', tags:['slavic','nightlife'], badges:['new'], from:0, was:0, sold:100 }
];

const CODES = [
  { code:'SPARK40',   label:'Early bird, 40% off',        off:0.40, maxQty:10 },
  { code:'FOURPLAY',  label:'Group deal, 25% off',        off:0.25, maxQty:10 },
  { code:'RESIDENT8', label:'Resident series, 20% off',   off:0.20, maxQty:10 }
];

// Ghost players so the board looks alive on day one. Delete them before launch
// with:  db.players.deleteMany({ isSeed: true })
const GHOSTS = [
  ['nocturne_kv',71240,'2026-08-11'], ['Mira T.',63880,'2026-08-12'],
  ['bassline_bruno',58410,'2026-08-09'], ['404_dancer',52960,'2026-08-14'],
  ['Yana R.',48120,'2026-08-15'], ['lowfreq',43700,'2026-08-10'],
  ['Tomas W.',39250,'2026-08-13'], ['strobe_kid',34910,'2026-08-16'],
  ['Alina D.',29480,'2026-08-17'], ['kick_drum_kim',24060,'2026-08-08']
];

const run = async () => {
  await connectDB(process.env.MONGODB_URI);

  for(const e of EVENTS)
    await Event.updateOne({slug:e.slug},{$set:{...e,date:new Date(e.date)}},{upsert:true});
  console.log('  ✓ %d events', EVENTS.length);

  for(const c of CODES)
    await PromoCode.updateOne({code:c.code},{$set:c},{upsert:true});
  console.log('  ✓ %d promo codes', CODES.length);

  for(const [handle,score,at] of GHOSTS){
    await Player.updateOne(
      { email:`${handle.toLowerCase().replace(/[^a-z0-9]/g,'')}@seed.iskra` },
      { $set:{ handle, bestScore:score, bestAt:new Date(at), isSeed:true, consent:true },
        $setOnInsert:{ token: crypto.randomBytes(24).toString('hex') } },
      { upsert:true }
    );
  }
  console.log('  ✓ %d seed players', GHOSTS.length);

  await mongoose.disconnect();
  console.log('  ✓ Seed complete');
};
run().catch(e=>{ console.error('  ✗ Seed failed:', e.message); process.exit(1); });
