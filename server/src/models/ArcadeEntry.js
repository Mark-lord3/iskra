import mongoose from 'mongoose';

const playSchema=new mongoose.Schema({
  score:{type:Number,required:true},hits:{type:Number,default:0},bestMult:{type:Number,default:1},
  roundId:{type:String,required:true},at:{type:Date,default:Date.now}
},{_id:false});

const schema=new mongoose.Schema({
  contest:{type:mongoose.Schema.Types.ObjectId,ref:'ArcadeContest',required:true,index:true},
  eventSlug:{type:String,required:true,index:true},
  player:{type:mongoose.Schema.Types.ObjectId,ref:'Player',required:true,index:true},
  handle:{type:String,required:true,trim:true,maxlength:18},
  email:{type:String,required:true,lowercase:true,trim:true},
  bestScore:{type:Number,default:0,index:true},bestAt:{type:Date,default:null},
  plays:{type:[playSchema],default:[]},attemptsDate:{type:String,default:''},attemptsUsed:{type:Number,default:0},
  finalizedRank:{type:Number,default:null},
  rewardTier:{type:String,enum:['top1','top2','top5','played',null],default:null},
  rewardCode:{type:String,default:null},rewardRedeemed:{type:Boolean,default:false},
  rewardOrderId:{type:mongoose.Schema.Types.ObjectId,ref:'Order',default:null,index:true},
  rewardReservedAt:{type:Date,default:null},
  rewardEmailStatus:{type:String,enum:['pending','sending','sent','failed','skipped'],default:'pending'},
  rewardEmailId:{type:String,default:null},rewardEmailError:{type:String,default:null},rewardEmailSentAt:{type:Date,default:null}
},{timestamps:true});

schema.index({contest:1,player:1},{unique:true});
schema.index({contest:1,bestScore:-1,bestAt:1});
schema.index({rewardCode:1},{unique:true,partialFilterExpression:{rewardCode:{$type:'string'}}});

export default mongoose.model('ArcadeEntry',schema);
