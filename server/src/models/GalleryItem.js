import mongoose from 'mongoose';

const galleryItemSchema = new mongoose.Schema({
  url:{type:String,required:true},
  alt:{type:String,required:true},
  order:{type:Number,default:0},
  active:{type:Boolean,default:true}
},{timestamps:true});

export default mongoose.model('GalleryItem', galleryItemSchema);
