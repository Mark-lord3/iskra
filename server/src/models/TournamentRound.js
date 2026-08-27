import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  tournament:{type:mongoose.Schema.Types.ObjectId, ref:'PokerTournament', required:true, index:true},
  number:{type:Number, required:true},                  // 1, 2, 3 (final)
  name:{type:String, enum:['round_one','round_two','final_round'], required:true},
  status:{type:String, enum:['pending','seating','running','completed'], default:'pending'},
  /* Copied from the tournament when the round is created, so a later edit to
     the tournament cannot retroactively change how a played round advanced. */
  advancementRule:{type:String, required:true},
  advancementValue:{type:Number, required:true},
  tieBreak:{type:String, required:true},
  startedAt:{type:Date, default:null},
  completedAt:{type:Date, default:null},
  playerCount:{type:Number, default:0},
  tableCount:{type:Number, default:0}
},{timestamps:true});

schema.index({ tournament:1, number:1 }, { unique:true });
export default mongoose.model('TournamentRound', schema);
