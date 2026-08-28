import mongoose from 'mongoose';

/**
 * A door device that has been authorised to verify and redeem tickets.
 *
 * The raw session token is shown to the device exactly once; only its SHA-256
 * hash is stored, so a database dump cannot be replayed against the scanner.
 * A session grants nothing except ticket verification and redemption.
 */
const scannerSessionSchema = new mongoose.Schema({
  tokenHash:{type:String,required:true,unique:true,index:true},
  // QR onboarding links are single-use even if their signed payload leaks.
  /* No default. A sparse unique index skips documents where the field is
     absent, but an explicit null is a value and collides — which meant only one
     passcode session could exist and the second bouncer to sign in got a 500. */
  inviteId:{type:String,unique:true,sparse:true,index:true},
  label:{type:String,default:'Door device',trim:true,maxlength:60},
  // null scope means every event; a slug restricts the device to one night.
  eventSlug:{type:String,default:null,index:true},
  expiresAt:{type:Date,required:true,index:true},
  revokedAt:{type:Date,default:null},
  lastSeenAt:{type:Date,default:null},
  scanCount:{type:Number,default:0},
  admitCount:{type:Number,default:0},
  userAgent:{type:String,default:''},
  ip:{type:String,default:''}
},{timestamps:true});

scannerSessionSchema.methods.isUsable = function(now = new Date()){
  return !this.revokedAt && this.expiresAt > now;
};

export default mongoose.model('ScannerSession', scannerSessionSchema);
