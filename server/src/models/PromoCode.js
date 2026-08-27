import mongoose from 'mongoose';

/**
 * Public marketing campaigns. These are the only codes that may ever be listed
 * publicly. Codes a player earns in Spark Rush live on the Player document and
 * are never surfaced by any listing endpoint.
 */
const promoSchema = new mongoose.Schema({
  code:{type:String,required:true,unique:true,uppercase:true,trim:true},
  label:{type:String,required:true},
  off:{type:Number,default:0},      // 0.40 = 40% off
  flat:{type:Number,default:0},     // fixed price per ticket, overrides off
  minQty:{type:Number,default:1},   // tickets required before the code applies
  maxQty:{type:Number,default:10},  // how many tickets the discount covers
  // Whether this offer combines with the standing group deal. When false the
  // better of the two is applied and the page says so, so a visitor is never
  // shown two offers adding up when they cannot.
  stackable:{type:Boolean,default:true},
  active:{type:Boolean,default:true},
  startsAt:{type:Date,default:null},
  expiresAt:{type:Date,default:null},
  // Drives the distinct visual treatment on the offers page.
  kind:{type:String,enum:['early','group','resident','table','reward'],default:'early'},
  appliesTo:{type:String,default:'all'},  // 'all' or a comma separated list of event slugs
  /* Promotional copy shown on the offers page, per language. Falls back to
     `label` when a translation has not been written. */
  text:{
    en:{ headline:String, blurb:String },
    uk:{ headline:String, blurb:String },
    ru:{ headline:String, blurb:String }
  }
},{timestamps:true});

/** Does this code apply to a given event? */
promoSchema.methods.coversEvent = function(slug){
  const scope = String(this.appliesTo || 'all').trim();
  if(!scope || scope === 'all') return true;
  return scope.split(',').map(s => s.trim()).filter(Boolean).includes(String(slug));
};

/** live | scheduled | expired, derived rather than stored so it cannot go stale. */
promoSchema.methods.status = function(now = new Date()){
  if(!this.active) return 'inactive';
  if(this.startsAt && this.startsAt > now) return 'scheduled';
  if(this.expiresAt && this.expiresAt < now) return 'expired';
  return 'live';
};

export default mongoose.model('PromoCode', promoSchema);
