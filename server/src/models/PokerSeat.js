import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  table:{type:mongoose.Schema.Types.ObjectId, ref:'PokerTable', required:true, index:true},
  tournament:{type:mongoose.Schema.Types.ObjectId, ref:'PokerTournament', required:true, index:true},
  user:{type:mongoose.Schema.Types.ObjectId, ref:'User', required:true, index:true},
  seatIndex:{type:Number, required:true, min:0, max:8},
  displayName:{type:String, required:true},
  stack:{type:Number, required:true, min:0},
  status:{type:String, enum:['active','sitting_out','disconnected','eliminated','moved'],
          default:'active', index:true},
  eliminatedAt:{type:Date, default:null},
  eliminationOrder:{type:Number, default:null},
  lastSeenAt:{type:Date, default:null}
},{timestamps:true});

// A seat can hold one player, and a player can hold one seat per table.
schema.index({ table:1, seatIndex:1 }, { unique:true });
schema.index({ table:1, user:1 }, { unique:true });
export default mongoose.model('PokerSeat', schema);
