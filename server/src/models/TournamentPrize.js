import mongoose from 'mongoose';

/**
 * A configured placement prize and, after the tournament, its fulfilment.
 * `issuanceKey` is unique, so a retried fulfilment can never mint a second set
 * of tickets for the same placement.
 */
const schema = new mongoose.Schema({
  tournament:{type:mongoose.Schema.Types.ObjectId, ref:'PokerTournament', required:true, index:true},
  placement:{type:Number, required:true, min:1, max:3},
  eventSlug:{type:String, required:true},
  ticketTier:{type:String, required:true},              // e.g. "VIP", "General admission"
  ticketQuantity:{type:Number, required:true, min:1, max:10},
  approximateRetailValue:{type:Number, required:true},  // disclosed, never hidden
  currency:{type:String, default:'CAD'},
  restrictions:{type:String, default:''},

  awardedTo:{type:mongoose.Schema.Types.ObjectId, ref:'User', default:null},
  // Omit this field until fulfillment. A sparse unique index still indexes an
  // explicit null, which would prevent more than one configured prize.
  issuanceKey:{type:String, default:undefined},
  issuedTicketRefs:{type:[String], default:[]},
  status:{type:String, enum:['configured','pending','delivered','claimed','expired','manual_review'],
          default:'configured', index:true},
  deliveredAt:{type:Date, default:null},
  claimedAt:{type:Date, default:null},
  claimDeadlineAt:{type:Date, default:null}
},{timestamps:true});

schema.index({ tournament:1, placement:1 }, { unique:true });
schema.index({ issuanceKey:1 }, {
  unique:true,
  partialFilterExpression:{ issuanceKey:{ $type:'string' } }
});
export default mongoose.model('TournamentPrize', schema);
