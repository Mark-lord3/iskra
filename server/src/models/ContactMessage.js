import mongoose from 'mongoose';

export default mongoose.model('ContactMessage', new mongoose.Schema({
  name:{type:String,required:true,trim:true,maxlength:80},
  email:{type:String,required:true,lowercase:true,trim:true,maxlength:120},
  subject:{type:String,default:'General',trim:true,maxlength:120},
  message:{type:String,required:true,trim:true,maxlength:1600},
  // Enquiry routing and the details the team asks for on every booking.
  category:{type:String,default:'general',trim:true,maxlength:40},
  eventDate:{type:Date,default:null},
  groupSize:{type:Number,default:null,min:1,max:500},
  status:{type:String,enum:['new','read','archived'],default:'new'}
},{timestamps:true}));
