import mongoose from 'mongoose';

const siteSettingSchema = new mongoose.Schema({
  key:{type:String,required:true,unique:true},
  value:{type:mongoose.Schema.Types.Mixed,default:{}}
},{timestamps:true});

export default mongoose.model('SiteSetting', siteSettingSchema);
