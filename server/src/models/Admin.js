import mongoose from 'mongoose';

/**
 * A named administrator. Passwords are stored only as bcrypt hashes, and the
 * hash is never selected by default so it cannot leak through a stray query.
 */
const adminSchema = new mongoose.Schema({
  email:{type:String, required:true, unique:true, lowercase:true, trim:true, index:true},
  name:{type:String, default:'Administrator', trim:true, maxlength:60},
  passwordHash:{type:String, required:true, select:false},
  role:{type:String, enum:['owner','manager'], default:'owner'},
  // Brute-force protection: repeated failures lock the account for a while.
  failedAttempts:{type:Number, default:0},
  lockedUntil:{type:Date, default:null},
  lastLoginAt:{type:Date, default:null},
  passwordChangedAt:{type:Date, default:null}
},{timestamps:true});

adminSchema.methods.isLocked = function(now = new Date()){
  return !!this.lockedUntil && this.lockedUntil > now;
};

export default mongoose.model('Admin', adminSchema);
