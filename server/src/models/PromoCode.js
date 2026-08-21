import mongoose from 'mongoose';

const promoSchema = new mongoose.Schema({
  code:{type:String,required:true,unique:true,uppercase:true,trim:true},
  label:{type:String,required:true},
  off:{type:Number,default:0},      // 0.40 = 40% off
  flat:{type:Number,default:0},     // fixed price per ticket, overrides off
  maxQty:{type:Number,default:10},
  active:{type:Boolean,default:true},
  expiresAt:{type:Date,default:null}
},{timestamps:true});

export default mongoose.model('PromoCode', promoSchema);
