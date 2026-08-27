import mongoose from 'mongoose';

const schema=new mongoose.Schema({
  visitorHash:{type:String,required:true,index:true},
  userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null,index:true},
  campaignId:{type:mongoose.Schema.Types.ObjectId,ref:'Campaign',required:true,index:true},
  impressions:{type:Number,default:0},
  dismissals:{type:Number,default:0},
  convertedAt:{type:Date,default:null},
  lastImpressionAt:{type:Date,default:null},
  lastPath:{type:String,default:''}
},{timestamps:true});
schema.index({visitorHash:1,campaignId:1},{unique:true});
export default mongoose.model('CampaignExposure',schema);
