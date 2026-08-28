import mongoose from 'mongoose';

const discountSchema=new mongoose.Schema({
  type:{type:String,enum:['none','percent','fixed'],default:'none'},
  value:{type:Number,default:0,min:0}
},{_id:false});

const auditSchema=new mongoose.Schema({
  action:{type:String,required:true},actorId:{type:mongoose.Schema.Types.ObjectId,ref:'Admin',default:null},
  at:{type:Date,default:Date.now},details:{type:mongoose.Schema.Types.Mixed,default:null}
},{_id:false});

const schema=new mongoose.Schema({
  eventSlug:{type:String,required:true,index:true},
  customerName:{type:String,default:''},customerEmail:{type:String,default:'',lowercase:true,index:true},restrictEmail:{type:Boolean,default:false},
  title:{type:String,required:true},description:{type:String,default:''},currency:{type:String,default:'cad'},
  admission:{tierKey:{type:String,enum:['general','early'],default:'general'},qty:{type:Number,default:0,min:0,max:20},unitPrice:{type:Number,default:0,min:0},discount:discountSchema},
  vip:{qty:{type:Number,default:0,min:0,max:4},unitPrice:{type:Number,default:0,min:0},discount:discountSchema,inclusions:{type:[String],default:[]},reservationMode:{type:String,enum:['checkout','immediate'],default:'checkout'}},
  allowPromoStacking:{type:Boolean,default:false},internalNotes:{type:String,default:''},
  codeHash:{type:String,required:true,unique:true,index:true},codeCiphertext:{type:String,required:true},codeIv:{type:String,required:true},codeTag:{type:String,required:true},codeSuffix:{type:String,required:true},
  status:{type:String,enum:['draft','active','reserved','partially_redeemed','redeemed','expired','cancelled'],default:'active',index:true},
  expiresAt:{type:Date,default:null,index:true},maxRedemptions:{type:Number,default:1,min:1,max:100},redemptionCount:{type:Number,default:0,min:0},
  reservedOrderId:{type:mongoose.Schema.Types.ObjectId,ref:'Order',default:null,index:true},reservedAt:{type:Date,default:null},usedAt:{type:Date,default:null},
  vipReservationTokens:{type:[String],default:[]},createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'Admin',default:null},updatedBy:{type:mongoose.Schema.Types.ObjectId,ref:'Admin',default:null},audit:{type:[auditSchema],default:[]}
},{timestamps:true});

schema.index({createdAt:-1});
export default mongoose.model('CustomOrder',schema);
