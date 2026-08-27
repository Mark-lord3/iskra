import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  eventSlug:{type:String,required:true,unique:true,index:true},
  eventTitle:{type:String,required:true},
  eventDate:{type:Date,required:true,index:true},
  opensAt:{type:Date,required:true},
  closesAt:{type:Date,required:true,index:true},
  minParticipants:{type:Number,min:30,max:50,default:30},
  status:{type:String,enum:['open','closed_pending','finalizing','finalized'],default:'open',index:true},
  participantCount:{type:Number,default:0},
  finalizedAt:{type:Date,default:null}
},{timestamps:true});

export default mongoose.model('ArcadeContest',schema);
