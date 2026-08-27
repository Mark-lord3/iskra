import mongoose from 'mongoose';

/**
 * An immutable snapshot of the official rules. A published tournament points at
 * one of these; the document is never edited afterwards, so what a player
 * agreed to can always be reproduced.
 */
const schema = new mongoose.Schema({
  tournament:{type:mongoose.Schema.Types.ObjectId, ref:'PokerTournament', required:true, index:true},
  version:{type:Number, required:true},
  locale:{type:String, enum:['en','uk','ru'], default:'en'},
  bodyMarkdown:{type:String, required:true},
  /* The disclosures the rules must carry, tracked so a draft cannot quietly
     omit one. Content is authored by a human reviewer, never generated. */
  disclosures:{
    sponsor:String, administrator:String, eligibility:String, excludedPersons:String,
    geographicArea:String, noPurchaseStatement:String, openDate:Date, closeDate:Date,
    prizeDescription:String, approximateRetailValue:String, oddsStatement:String,
    advancementRules:String, tieBreaking:String, disqualification:String,
    winnerVerification:String, prizeDeadline:String, cancellationPolicy:String,
    forceMajeure:String, privacy:String, publicity:String, dataRetention:String
  },
  authoredBy:{type:mongoose.Schema.Types.ObjectId, ref:'Admin', default:null},
  approvedBy:{type:String, default:''},
  approvedAt:{type:Date, default:null},
  contentHash:{type:String, required:true, index:true}   // detects any later edit
},{timestamps:true});

schema.index({ tournament:1, version:1, locale:1 }, { unique:true });
export default mongoose.model('TournamentRulesVersion', schema);
