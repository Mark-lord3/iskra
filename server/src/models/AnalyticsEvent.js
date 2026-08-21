import mongoose from 'mongoose';

export default mongoose.model('AnalyticsEvent', new mongoose.Schema({
  type:{type:String,required:true,enum:['visit','click','signup','contact']},
  path:{type:String,default:'/'},
  label:{type:String,default:''},
  referrer:{type:String,default:''},
  userAgent:{type:String,default:''},
  ip:{type:String,default:''}
},{timestamps:true}));

