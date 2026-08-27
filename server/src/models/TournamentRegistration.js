import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  tournament:{type:mongoose.Schema.Types.ObjectId, ref:'PokerTournament', required:true, index:true},
  user:{type:mongoose.Schema.Types.ObjectId, ref:'User', required:true, index:true},
  displayName:{type:String, required:true, trim:true, maxlength:18},
  status:{type:String, enum:['registered','checked_in','withdrawn','disqualified','no_show'],
          default:'registered', index:true},
  registeredAt:{type:Date, default:Date.now},
  checkedInAt:{type:Date, default:null},
  /* Consent is recorded separately: accepting the rules is required to enter,
     marketing is not and must never be bundled with it. */
  rulesVersion:{type:mongoose.Schema.Types.ObjectId, ref:'TournamentRulesVersion', required:true},
  rulesAcceptedAt:{type:Date, required:true},
  marketingConsent:{type:Boolean, default:false},
  disqualifiedReason:{type:String, default:''},
  disqualifiedBy:{type:mongoose.Schema.Types.ObjectId, ref:'Admin', default:null}
},{timestamps:true});

// One entry per person per tournament, enforced by the database.
schema.index({ tournament:1, user:1 }, { unique:true });
export default mongoose.model('TournamentRegistration', schema);
