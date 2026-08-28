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
  status:{type:String,enum:['new','read','archived','replied'],default:'new'},
  /* Every reply the team sends, kept on the enquiry so the thread is readable
     later and so a delivery failure is visible rather than silent. */
  replies:[{
    body:{type:String,required:true,trim:true,maxlength:4000},
    sentBy:{type:String,default:''},           // administrator email
    sentAt:{type:Date,default:Date.now},
    emailId:{type:String,default:null},        // provider id, for tracing
    deliveryStatus:{type:String,enum:['sent','failed'],default:'sent'},
    error:{type:String,default:''}
  }],
  repliedAt:{type:Date,default:null}
},{timestamps:true}));
