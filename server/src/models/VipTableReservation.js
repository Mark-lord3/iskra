import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  eventSlug:{type:String,required:true,index:true},
  slot:{type:Number,required:true,min:1,max:4},
  orderId:{type:mongoose.Schema.Types.ObjectId,ref:'Order',default:null,index:true},
  customOrderId:{type:mongoose.Schema.Types.ObjectId,ref:'CustomOrder',default:null,index:true},
  token:{type:String,required:true,unique:true,index:true},
  status:{type:String,enum:['pending','paid'],default:'pending',index:true},
  expiresAt:{type:Date,default:null}
},{timestamps:true});

schema.index({eventSlug:1,slot:1},{unique:true});
schema.index({expiresAt:1},{expireAfterSeconds:0});

export default mongoose.model('VipTableReservation',schema);
