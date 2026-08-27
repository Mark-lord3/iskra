import mongoose from 'mongoose';

/**
 * Only one process may drive live tables. Two processes dealing the same table
 * would produce two different truths, so every instance competes for this lock
 * and renews it; a crashed holder's lock simply expires.
 */
const schema = new mongoose.Schema({
  key:{type:String, required:true, unique:true, default:'engine'},
  holder:{type:String, required:true},
  expiresAt:{type:Date, required:true}
},{timestamps:true});

export default mongoose.model('PokerEngineLock', schema);
