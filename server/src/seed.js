import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './db.js';
import {databaseUri} from './config/database.js';
import Event from './models/Event.js';
import PromoCode from './models/PromoCode.js';
import Campaign from './models/Campaign.js';

/* Times are the venue's wall clock, written as UTC so every visitor sees the
   same door time instead of one shifted into their own timezone. */
const RETIRED_EVENT_SLUGS = [
  'closing-vera-ostrov',
  'deep-end-marlo-pace',
  'resident-series-014',
  'iskra-vs-kontur',
  'ember-live-machines',
  'sunset-to-sunrise'
];

const PUBLIC_EVENTS = [{
  slug:'project-iskra-grand-opening',
  date:new Date('2026-08-29T02:00:00Z'),
  title:'Project ISKRA Grand Opening',
  support:'DJ MLNK · Slavic Music',
  room:'Muzique Nightclub',
  address:'3781 Boulevard Saint-Laurent, Montréal, QC H2W 1X8',
  description:'The first public spark from Project ISKRA. DJ MLNK, Slavic Music, and a full-scale Grand Opening night at Muzique Nightclub.',
  image:'/last-event/grand-opening-poster.png',
  tags:['house','slavic music','grand opening'],
  badges:['grand opening'],
  from:25,
  was:0,
  sold:0,
  capacity:0,
  arcadeEnabled:true,
  arcadeMinParticipants:30,
  active:true
}];

/* Real public campaigns. Validity lives here and is served by the API, so the
   offers page never hardcodes a date or a discount. */
const CODES = [
  { code:'SPARK40',   label:'Early bird, 40% off',      off:0.40, minQty:10, maxQty:20, kind:'early',
    startsAt:new Date('2026-08-01T00:00:00Z'), expiresAt:new Date('2026-12-31T23:59:00Z'), appliesTo:'all' },
  { code:'FOURPLAY',  label:'Group deal, 25% off',      off:0.25, minQty:6,  maxQty:20, kind:'group',
    startsAt:new Date('2026-08-01T00:00:00Z'), expiresAt:new Date('2026-12-31T23:59:00Z'), appliesTo:'all' },
  { code:'RESIDENT8', label:'Resident series, 20% off', off:0.20, minQty:4,  maxQty:20, kind:'resident',
    startsAt:new Date('2026-08-01T00:00:00Z'), expiresAt:new Date('2026-12-31T23:59:00Z'), appliesTo:'all' }
];

const run = async () => {
  await connectDB(databaseUri());

  await Event.updateMany({slug:{$in:RETIRED_EVENT_SLUGS}},{$set:{active:false}});
  console.log('  ✓ retired incorrect placeholder events');

  await Event.deleteOne({slug:'blackout-nadia-volkov'});
  for(const event of PUBLIC_EVENTS)
    await Event.updateOne({slug:event.slug},{$set:event},{upsert:true});
  console.log('  ✓ removed Nadia Volkov placeholder and published Grand Opening at $25');

  for(const c of CODES)
    await PromoCode.updateOne({code:c.code},{$set:c},{upsert:true});
  console.log('  ✓ %d promo codes', CODES.length);

  await Campaign.updateOne({key:'anonymous-account-invite'},{$set:{
    key:'anonymous-account-invite',
    title:{en:'Keep every spark.',uk:'Збережіть кожну іскру.',ru:'Сохраните каждую искру.'},
    text:{en:'Create an ISKRA account for server-backed tickets, private offers and first access to the next night.',uk:'Створіть акаунт ISKRA для надійного зберігання квитків, приватних пропозицій і раннього доступу.',ru:'Создайте аккаунт ISKRA для надежного хранения билетов, приватных предложений и раннего доступа.'},
    cta:{en:'Create my account',uk:'Створити акаунт',ru:'Создать аккаунт'},
    href:'/account',placement:'popup',audience:'anonymous',priority:100,frequencyCap:3,
    active:true,conversionGoal:'account_registration',variant:'account-control'
  }},{upsert:true});
  console.log('  ✓ acquisition campaign');

  await mongoose.disconnect();
  console.log('  ✓ Seed complete');
};
run().catch(e=>{ console.error('  ✗ Seed failed:', e.message); process.exit(1); });
