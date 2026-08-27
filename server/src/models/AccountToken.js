import mongoose from 'mongoose';

const schema=new mongoose.Schema({
  userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  tokenHash:{type:String,required:true,unique:true,index:true},
  purpose:{type:String,enum:['verify','reset','magic'],required:true,index:true},
  expiresAt:{type:Date,required:true,index:{expires:0}},
  usedAt:{type:Date,default:null}
},{timestamps:true});

export default mongoose.model('AccountToken',schema);
