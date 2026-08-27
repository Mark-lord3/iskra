import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  tournament:{type:mongoose.Schema.Types.ObjectId, ref:'PokerTournament', required:true, index:true},
  user:{type:mongoose.Schema.Types.ObjectId, ref:'User', required:true, index:true},
  displayName:{type:String, required:true},
  placement:{type:Number, default:null, index:true},    // 1, 2, 3, then the rest
  eliminationOrder:{type:Number, default:null},
  finishingChips:{type:Number, default:0},
  roundReached:{type:String, default:'round_one'},
  eliminatedAt:{type:Date, default:null},
  prizeStatus:{type:String, enum:['none','pending','delivered','claimed','expired','manual_review'],
               default:'none', index:true}
},{timestamps:true});

schema.index({ tournament:1, user:1 }, { unique:true });
export default mongoose.model('TournamentResult', schema);
