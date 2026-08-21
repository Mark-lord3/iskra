import mongoose from 'mongoose';

export default mongoose.model('ContactMessage', new mongoose.Schema({
  name:{type:String,required:true,trim:true,maxlength:80},
  email:{type:String,required:true,lowercase:true,trim:true,maxlength:120},
  subject:{type:String,default:'General',trim:true,maxlength:120},
  message:{type:String,required:true,trim:true,maxlength:1600},
  status:{type:String,enum:['new','read','archived'],default:'new'}
},{timestamps:true}));

