import mongoose from 'mongoose';
export default mongoose.model('Subscriber', new mongoose.Schema({
  email:{type:String,required:true,lowercase:true,trim:true,unique:true},
  source:{type:String,default:'newsletter'}
},{timestamps:true}));
