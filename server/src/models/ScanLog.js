import mongoose from 'mongoose';

/** Append-only audit trail of every door decision. */
export default mongoose.model('ScanLog', new mongoose.Schema({
  sessionId:{type:mongoose.Schema.Types.ObjectId, ref:'ScannerSession', index:true},
  label:{type:String, default:''},
  reference:{type:String, default:'', index:true},
  ticketId:{type:mongoose.Schema.Types.ObjectId, ref:'Ticket', default:null},
  outcome:{type:String, required:true, index:true},   // admitted | already_used | invalid | ...
  eventSlug:{type:String, default:''},
  ip:{type:String, default:''}
},{timestamps:true}));
