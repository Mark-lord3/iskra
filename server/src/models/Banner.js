import mongoose from 'mongoose';

export default mongoose.model('Banner', new mongoose.Schema({
  title:{type:String,required:true,trim:true,maxlength:120},
  text:{type:String,default:'',trim:true,maxlength:260},
  cta:{type:String,default:'Join the list',trim:true,maxlength:40},
  href:{type:String,default:'#newsletter',trim:true,maxlength:200},
  active:{type:Boolean,default:true},
  placement:{type:String,default:'home'}
},{timestamps:true}));

