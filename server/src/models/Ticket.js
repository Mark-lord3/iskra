import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
  reference:{type:String,required:true,unique:true,index:true},
  accessToken:{type:String,required:true,select:false},
  qrSecret:{type:String,required:true,select:false},
  qrPayload:{type:String,required:true,unique:true,select:false},
  eventSlug:{type:String,required:true,index:true},
  eventTitle:{type:String,required:true},
  eventDate:{type:Date,required:true},
  room:{type:String,default:''},
  buyerName:{type:String,required:true},
  buyerEmail:{type:String,required:true,index:true},
  tier:{type:String,default:'General admission'},
  price:{type:Number,default:0},
  admissionValid:{type:Boolean,default:true,index:true},
  orderId:{type:mongoose.Schema.Types.ObjectId,ref:'Order',default:null,index:true},
  userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null,index:true},
  stripeSessionId:{type:String,default:null,index:true},
  status:{type:String,enum:['reserved','redeemed','cancelled'],default:'reserved',index:true},
  redeemedAt:{type:Date,default:null}
},{timestamps:true});

export default mongoose.model('Ticket', ticketSchema);
