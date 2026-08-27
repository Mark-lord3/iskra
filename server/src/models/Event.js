import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  slug:{type:String,required:true,unique:true},
  date:{type:Date,required:true,index:true},
  title:{type:String,required:true},
  support:{type:String,default:''},
  room:{type:String,default:'Main Hall'},
  address:{type:String,default:''},
  description:{type:String,default:''},
  image:{type:String,default:''},
  tags:{type:[String],default:[]},
  badges:{type:[String],default:[]},
  from:{type:Number,default:0},   // current price
  was:{type:Number,default:0},    // struck-through price, 0 = none
  sold:{type:Number,default:0},   // percent sold, 100 = sold out
  capacity:{type:Number,default:0},
  arcadeEnabled:{type:Boolean,default:true},
  arcadeMinParticipants:{type:Number,min:30,max:50,default:30},
  active:{type:Boolean,default:true}
},{timestamps:true});

export default mongoose.model('Event', eventSchema);
