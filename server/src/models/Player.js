import mongoose from 'mongoose';

const playSchema = new mongoose.Schema({
  score:{type:Number,required:true},
  hits:{type:Number,default:0},
  bestMult:{type:Number,default:1},
  roundId:{type:String,default:null},   // client round id, used to reject replays
  at:{type:Date,default:Date.now}
},{_id:false});

const playerSchema = new mongoose.Schema({
  handle:{type:String,required:true,trim:true,maxlength:18},
  email:{type:String,required:true,lowercase:true,trim:true,unique:true,sparse:true},
  token:{type:String,required:true,select:false},
  bestScore:{type:Number,default:0,index:true},
  bestAt:{type:Date,default:null},
  plays:{type:[playSchema],default:[]},
  attemptsDate:{type:String,default:''},   // YYYY-MM-DD
  attemptsUsed:{type:Number,default:0},
  rewardTier:{type:String,default:null},
  rewardCode:{type:String,default:null,index:true},
  rewardRedeemed:{type:Boolean,default:false},
  consent:{type:Boolean,default:false}
},{timestamps:true});

playerSchema.index({bestScore:-1, bestAt:1});

export default mongoose.model('Player', playerSchema);
