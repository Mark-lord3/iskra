import mongoose from 'mongoose';

const schema=new mongoose.Schema({
  key:{type:String,required:true,unique:true,index:true},
  title:{type:Map,of:String,required:true},
  text:{type:Map,of:String,default:{}},
  cta:{type:Map,of:String,default:{}},
  href:{type:String,required:true},
  placement:{type:String,enum:['popup','banner','account'],default:'popup',index:true},
  audience:{type:String,enum:['anonymous','authenticated','all'],default:'anonymous'},
  priority:{type:Number,default:0},
  frequencyCap:{type:Number,default:1,min:1,max:5},
  startsAt:{type:Date,default:null},
  endsAt:{type:Date,default:null},
  active:{type:Boolean,default:true,index:true},
  conversionGoal:{type:String,default:'account_registration'},
  variant:{type:String,default:'control'}
},{timestamps:true});
export default mongoose.model('Campaign',schema);
