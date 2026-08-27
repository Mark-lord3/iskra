import Tournament from '../models/PokerTournament.js';
import Prize from '../models/TournamentPrize.js';
import Result from '../models/TournamentResult.js';
import Audit from '../models/TournamentAuditEvent.js';
import Event from '../models/Event.js';
import User from '../models/User.js';
import { mintTickets } from '../lib/issueTickets.js';
import { issuanceKey } from './lifecycle.js';

/**
 * Turn finishing places into real tickets.
 *
 * Prizes are event tickets, never cash and never anything transferable for
 * money. Fulfilment is idempotent: the issuance key is written with a unique
 * index, so replaying this — after a crash, a retry, or an admin clicking
 * twice — cannot mint a second set of tickets for the same placement.
 */
export async function fulfillPrizes(tournamentId, { actor = 'system' } = {}){
  const tournament = await Tournament.findById(tournamentId);
  if(!tournament) return { ok:false, code:'NOT_FOUND' };
  if(tournament.state !== 'completed') return { ok:false, code:'NOT_COMPLETED' };

  const prizes = await Prize.find({ tournament: tournamentId }).sort({ placement:1 });
  const issued = [];

  for(const prize of prizes){
    const result = await Result.findOne({ tournament: tournamentId, placement: prize.placement });
    if(!result){ continue; }

    const key = issuanceKey(String(tournamentId), prize.placement, String(result.user));
    if(prize.issuanceKey === key && prize.status !== 'configured'){
      issued.push({ placement: prize.placement, already: true });
      continue;
    }

    // Claim the placement first. If another worker already claimed it the
    // unique index rejects this update and we skip, rather than double-issuing.
    const claimed = await Prize.findOneAndUpdate(
      { _id: prize._id, $or:[{ issuanceKey: null }, { issuanceKey: key }], status:'configured' },
      { $set:{ issuanceKey: key, awardedTo: result.user, status:'pending' } },
      { new: true }
    ).catch(err => { if(err?.code === 11000) return null; throw err; });
    if(!claimed){ issued.push({ placement: prize.placement, already: true }); continue; }

    const event = await Event.findOne({ slug: prize.eventSlug }).lean();
    const user = await User.findById(result.user).lean();
    if(!event || !user){
      await Prize.updateOne({ _id: prize._id }, { $set:{ status:'manual_review' } });
      await Result.updateOne({ _id: result._id }, { $set:{ prizeStatus:'manual_review' } });
      issued.push({ placement: prize.placement, status:'manual_review',
                    reason: event ? 'winner account missing' : 'event missing' });
      continue;
    }

    const tickets = await mintTickets({
      event, quantity: prize.ticketQuantity, buyerName: user.name,
      buyerEmail: user.email, tier: prize.ticketTier, userId: user._id
    });

    const deadline = new Date(Date.now() + (tournament.prizeClaimDeadlineDays || 30) * 86_400_000);
    await Prize.updateOne({ _id: prize._id }, { $set:{
      status:'delivered', deliveredAt: new Date(), claimDeadlineAt: deadline,
      issuedTicketRefs: tickets.map(t => t.reference)
    } });
    await Result.updateOne({ _id: result._id }, { $set:{ prizeStatus:'delivered' } });
    await Audit.create({ tournament: tournamentId, type:'prize_issued', actorType:'system', actor,
      subjectUser: result.user,
      detail:{ placement: prize.placement, quantity: prize.ticketQuantity,
               references: tickets.map(t => t.reference) } });

    issued.push({ placement: prize.placement, status:'delivered', quantity: tickets.length });
  }

  return { ok:true, issued };
}
