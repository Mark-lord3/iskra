import mongoose from 'mongoose';

/**
 * A finished or in-flight hand. `shuffleSeed` is written only once the hand is
 * complete, so a live hand cannot leak undealt cards even to an administrator.
 */
const schema = new mongoose.Schema({
  table:{type:mongoose.Schema.Types.ObjectId, ref:'PokerTable', required:true, index:true},
  tournament:{type:mongoose.Schema.Types.ObjectId, ref:'PokerTournament', required:true, index:true},
  handNumber:{type:Number, required:true},
  buttonSeat:{type:Number, required:true},
  smallBlind:{type:Number, required:true},
  bigBlind:{type:Number, required:true},
  ante:{type:Number, default:0},
  shuffleCommitment:{type:String, required:true, index:true},
  shuffleSeed:{type:String, default:null, select:false},
  board:{type:[Number], default:[]},
  state:{type:Object, default:null, select:false},      // engine snapshot, server only
  street:{type:String, default:'preflop'},
  version:{type:Number, default:0},
  pots:{type:[{ amount:Number, eligible:[Number] }], default:[]},
  payouts:{type:Object, default:null},
  showdown:{type:[{ seat:Number, hole:[Number], hand:String }], default:[]},
  startedAt:{type:Date, default:Date.now},
  completedAt:{type:Date, default:null}
},{timestamps:true});

schema.index({ table:1, handNumber:1 }, { unique:true });
export default mongoose.model('PokerHand', schema);
