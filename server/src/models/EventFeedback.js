import mongoose from 'mongoose';

const eventFeedbackSchema = new mongoose.Schema({
  ticketReference:{type:String,required:true,unique:true},
  eventSlug:{type:String,required:true,index:true},
  eventTitle:{type:String,required:true},
  rating:{type:Number,required:true,min:1,max:5},
  music:{type:Number,required:true,min:1,max:5},
  venue:{type:Number,required:true,min:1,max:5},
  comment:{type:String,default:'',maxlength:800}
},{timestamps:true});

export default mongoose.model('EventFeedback',eventFeedbackSchema);
