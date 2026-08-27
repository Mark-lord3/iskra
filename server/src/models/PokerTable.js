import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  tournament:{type:mongoose.Schema.Types.ObjectId, ref:'PokerTournament', required:true, index:true},
  round:{type:mongoose.Schema.Types.ObjectId, ref:'TournamentRound', required:true, index:true},
  label:{type:String, required:true},                   // "Table 7"
  size:{type:Number, enum:[6,9], required:true},
  status:{type:String, enum:['seating','running','balancing','broken','completed'], default:'seating'},
  buttonSeat:{type:Number, default:0},
  handNumber:{type:Number, default:0},
  blindLevel:{type:Number, default:1},
  levelStartedAt:{type:Date, default:null},
  isFinalTable:{type:Boolean, default:false}
},{timestamps:true});

schema.index({ tournament:1, round:1, label:1 }, { unique:true });
export default mongoose.model('PokerTable', schema);
