import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  tournament:{type:mongoose.Schema.Types.ObjectId, ref:'PokerTournament', default:null, index:true},
  table:{type:mongoose.Schema.Types.ObjectId, ref:'PokerTable', default:null},
  reporter:{type:mongoose.Schema.Types.ObjectId, ref:'User', required:true, index:true},
  reported:{type:mongoose.Schema.Types.ObjectId, ref:'User', required:true, index:true},
  category:{type:String, enum:['collusion','abuse','multi_accounting','stalling','other'],
            default:'other'},
  note:{type:String, default:'', maxlength:1000},
  /* Signals are advisory only. A prize is never withdrawn automatically: a
     human has to review and record a reason. */
  status:{type:String, enum:['open','reviewing','actioned','dismissed'], default:'open', index:true},
  reviewedBy:{type:mongoose.Schema.Types.ObjectId, ref:'Admin', default:null},
  reviewNote:{type:String, default:''},
  reviewedAt:{type:Date, default:null}
},{timestamps:true});

schema.index({ tournament:1, reported:1, reporter:1 }, { unique:true });
export default mongoose.model('PlayerReport', schema);
