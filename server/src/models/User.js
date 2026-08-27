import mongoose from 'mongoose';

const preferencesSchema=new mongoose.Schema({
  newsletter:{type:Boolean,default:false},
  eventReminders:{type:Boolean,default:true},
  offers:{type:Boolean,default:true},
  productUpdates:{type:Boolean,default:false}
},{_id:false});

const userSchema=new mongoose.Schema({
  email:{type:String,required:true,unique:true,index:true,lowercase:true,trim:true,maxlength:200},
  passwordHash:{type:String,required:true,select:false},
  name:{type:String,required:true,trim:true,maxlength:100},
  locale:{type:String,enum:['en','uk','ru'],default:'en'},
  status:{type:String,enum:['active','deleting','deleted'],default:'active',index:true},
  emailVerifiedAt:{type:Date,default:null},
  stripeCustomerId:{type:String,default:null,index:true,sparse:true},
  savedEvents:{type:[String],default:[]},
  preferences:{type:preferencesSchema,default:()=>({})},
  lastLoginAt:{type:Date,default:null},
  // Recorded when the player confirms they meet the minimum age for a
  // tournament. Never inferred, and never accepted from the client alone.
  ageConfirmedAt:{type:Date,default:null},
  deletedAt:{type:Date,default:null}
},{timestamps:true});

export default mongoose.model('User',userSchema);
