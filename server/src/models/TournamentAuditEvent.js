import mongoose from 'mongoose';

/** Append-only history. Nothing in the product ever updates or deletes these. */
const schema = new mongoose.Schema({
  tournament:{type:mongoose.Schema.Types.ObjectId, ref:'PokerTournament', required:true, index:true},
  type:{type:String, required:true, index:true},        // published, paused, disqualified, prize_issued...
  actorType:{type:String, enum:['admin','system','player'], default:'system'},
  actor:{type:String, default:''},
  subjectUser:{type:mongoose.Schema.Types.ObjectId, ref:'User', default:null},
  reason:{type:String, default:''},
  detail:{type:Object, default:{}},
  at:{type:Date, default:Date.now, index:true}
},{timestamps:true});

export default mongoose.model('TournamentAuditEvent', schema);
