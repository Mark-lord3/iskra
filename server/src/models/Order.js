import mongoose from 'mongoose';
// Demo orders — no payment is processed. Records what a checkout would have created.
export default mongoose.model('Order', new mongoose.Schema({
  eventSlug:{type:String,required:true},
  tier:{type:String,required:true},
  qty:{type:Number,required:true,min:1,max:10},
  subtotal:{type:Number,required:true},
  total:{type:Number,required:true},
  code:{type:String,default:null},
  playerId:{type:mongoose.Schema.Types.ObjectId,ref:'Player',default:null},
  email:{type:String,default:null},
  status:{type:String,default:'demo'}
},{timestamps:true}));
