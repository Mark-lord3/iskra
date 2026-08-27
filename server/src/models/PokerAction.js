import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  hand:{type:mongoose.Schema.Types.ObjectId, ref:'PokerHand', required:true, index:true},
  table:{type:mongoose.Schema.Types.ObjectId, ref:'PokerTable', required:true, index:true},
  seatIndex:{type:Number, required:true},
  user:{type:mongoose.Schema.Types.ObjectId, ref:'User', default:null},
  street:{type:String, required:true},
  type:{type:String, required:true},                    // fold, check, call, bet, raise, allin, timeout
  amount:{type:Number, default:0},
  toAmount:{type:Number, default:null},
  handVersion:{type:Number, required:true},
  actionId:{type:String, required:true},                // client-supplied idempotency key
  source:{type:String, enum:['player','timeout','system'], default:'player'},
  at:{type:Date, default:Date.now}
},{timestamps:true});

// The same click, retried, can only ever be recorded once.
schema.index({ hand:1, actionId:1 }, { unique:true });
export default mongoose.model('PokerAction', schema);
