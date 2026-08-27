import mongoose from 'mongoose';

export const TOURNAMENT_STATES = [
  'draft','scheduled','registration_open','registration_locked',
  'round_one','round_two','final_round','completed',
  'paused','cancelled','voided'
];

/** Legal sign-off is a gate, not a label: publication is blocked without it. */
export const LEGAL_REVIEW_STATES = ['not_reviewed','in_review','changes_requested','approved'];

const tournamentSchema = new mongoose.Schema({
  title:{type:String, required:true, trim:true, maxlength:120},
  slug:{type:String, required:true, unique:true, lowercase:true, trim:true, index:true},
  eventSlug:{type:String, required:true, index:true},   // the ISKRA night the prizes are for

  state:{type:String, enum:TOURNAMENT_STATES, default:'draft', index:true},

  /* Scheduling. Everything is stored UTC and rendered in `timezone`. */
  timezone:{type:String, default:'America/Toronto'},
  registrationOpensAt:{type:Date, default:null},
  registrationClosesAt:{type:Date, required:true},
  checkInClosesAt:{type:Date, default:null},
  startsAt:{type:Date, required:true, index:true},
  lateRegistration:{type:Boolean, default:false},       // off unless enabled before publishing

  /* Structure. Frozen once registration opens. */
  tableSize:{type:Number, enum:[6,9], default:9},
  // An optional cap on the field. Null means the pool is unlimited until
  // registration closes.
  maxPlayers:{type:Number, default:null},
  startingStack:{type:Number, default:10000, min:100},
  actionTimerSeconds:{type:Number, default:30, min:10, max:180},
  timeBankSeconds:{type:Number, default:60, min:0, max:600},
  blindSchedule:{type:[{ level:Number, smallBlind:Number, bigBlind:Number, ante:Number,
                         durationMinutes:Number, isBreak:Boolean }], default:[]},
  advancement:{
    roundOne:{ rule:{type:String, enum:['top_n_per_table','top_percent'], default:'top_n_per_table'},
               value:{type:Number, default:2} },
    roundTwo:{ rule:{type:String, enum:['top_n_per_table','top_percent'], default:'top_n_per_table'},
               value:{type:Number, default:1} },
    tieBreak:{type:String, default:'chip_count_then_elimination_order_then_random_seed'}
  },
  structureFrozenAt:{type:Date, default:null},          // set when registration opens

  /* Compliance. */
  rulesVersion:{type:mongoose.Schema.Types.ObjectId, ref:'TournamentRulesVersion', default:null},
  legalReviewStatus:{type:String, enum:LEGAL_REVIEW_STATES, default:'not_reviewed', index:true},
  legalReviewer:{type:String, default:''},
  legalApprovedAt:{type:Date, default:null},
  noPurchaseNecessary:{type:Boolean, default:true},     // the product is free; this is never false
  minimumAge:{type:Number, default:18},
  eligibilityRegion:{type:String, default:''},
  prizeClaimDeadlineDays:{type:Number, default:30},

  publishedAt:{type:Date, default:null},
  cancelledAt:{type:Date, default:null},
  cancellationReason:{type:String, default:''},
  createdBy:{type:mongoose.Schema.Types.ObjectId, ref:'Admin', default:null}
},{timestamps:true});

tournamentSchema.index({ state:1, startsAt:1 });

/** Publication requirements, checked in one place so no path can bypass them. */
tournamentSchema.methods.publishBlockers = function(prizeCount){
  const blockers = [];
  if(this.legalReviewStatus !== 'approved') blockers.push('LEGAL_NOT_APPROVED');
  if(!this.rulesVersion) blockers.push('NO_RULES_VERSION');
  if(!this.legalApprovedAt) blockers.push('NO_APPROVAL_TIMESTAMP');
  if(prizeCount !== 3) blockers.push('NEEDS_THREE_PLACEMENTS');
  if(!this.registrationClosesAt || !this.startsAt) blockers.push('NO_SCHEDULE');
  if(this.registrationClosesAt >= this.startsAt) blockers.push('REGISTRATION_AFTER_START');
  if(!this.noPurchaseNecessary) blockers.push('MUST_BE_FREE');
  return blockers;
};

/** Registration is only open inside the published window, decided server-side. */
tournamentSchema.methods.registrationOpen = function(now = new Date()){
  if(this.state !== 'registration_open') return false;
  if(this.registrationOpensAt && now < this.registrationOpensAt) return false;
  return now < this.registrationClosesAt;
};

export default mongoose.model('PokerTournament', tournamentSchema);
