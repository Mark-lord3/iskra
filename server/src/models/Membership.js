import mongoose from 'mongoose';

const schema=new mongoose.Schema({
  userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,unique:true,index:true},
  stripeCustomerId:{type:String,default:null,index:true},
  stripeSubscriptionId:{type:String,default:null,unique:true,sparse:true,index:true},
  stripePriceId:{type:String,default:null},
  status:{type:String,default:'inactive',index:true},
  plan:{type:String,default:'ISKRA Circle'},
  currentPeriodEnd:{type:Date,default:null},
  cancelAtPeriodEnd:{type:Boolean,default:false}
},{timestamps:true});

export default mongoose.model('Membership',schema);
