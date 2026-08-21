import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  slug:{type:String,required:true,unique:true},
  date:{type:Date,required:true,index:true},
  title:{type:String,required:true},
  support:{type:String,default:''},
  room:{type:String,default:'Main Hall'},
  tags:{type:[String],default:[]},
  badges:{type:[String],default:[]},
  from:{type:Number,default:0},   // current price
  was:{type:Number,default:0},    // struck-through price, 0 = none
  sold:{type:Number,default:0}    // percent sold, 100 = sold out
},{timestamps:true});

export default mongoose.model('Event', eventSchema);
