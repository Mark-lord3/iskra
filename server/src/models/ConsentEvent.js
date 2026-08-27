import mongoose from 'mongoose';
const schema=new mongoose.Schema({
  visitorHash:{type:String,required:true,index:true},
  userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null,index:true},
  choice:{type:String,enum:['granted','essential'],required:true},
  policyVersion:{type:String,default:'2026-08'},
  source:{type:String,default:'consent-banner'}
},{timestamps:true});
export default mongoose.model('ConsentEvent',schema);
