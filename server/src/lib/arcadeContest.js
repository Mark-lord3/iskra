import Event from '../models/Event.js';
import ArcadeContest from '../models/ArcadeContest.js';
import ArcadeEntry from '../models/ArcadeEntry.js';
import Player from '../models/Player.js';
import SiteSetting from '../models/SiteSetting.js';
import {claimCode,prizeForRank} from './prizes.js';
import {sendArcadeResultEmail} from '../services/arcadeEmail.js';

export const CUTOFF_DAYS=7;
export const PENDING_EVENT_SLUG='__next-iskra-event__';
const PENDING_EVENT_DATE=new Date('2100-01-01T00:00:00.000Z');
export const contestCloseAt=date=>new Date(new Date(date).getTime()-CUTOFF_DAYS*86400_000);
export const hasOpenContestWindow=(eventDate,now=new Date())=>contestCloseAt(eventDate)>now;

export async function arcadeSettings(){
  const row=await SiteSetting.findOne({key:'spark-rush'}).lean();
  return {
    enabled:row?.value?.enabled!==false,
    minParticipants:Math.min(50,Math.max(30,Number(row?.value?.minParticipants)||30))
  };
}

async function pendingContest(settings,now){
  return ArcadeContest.findOneAndUpdate(
    {eventSlug:PENDING_EVENT_SLUG},
    {$set:{
      eventTitle:'Next Project ISKRA event',eventDate:PENDING_EVENT_DATE,
      closesAt:PENDING_EVENT_DATE,minParticipants:settings.minParticipants,status:'open'
    },$setOnInsert:{opensAt:now,participantCount:0}},
    {upsert:true,new:true}
  );
}

/** Attach the live pre-schedule board without changing its id. ArcadeEntry
 * references therefore remain valid and every score follows the contest. */
async function attachPendingContest(event,now){
  const pending=await ArcadeContest.findOne({eventSlug:PENDING_EVENT_SLUG,status:'open'});
  if(!pending)return null;
  const existing=await ArcadeContest.findOne({eventSlug:event.slug});
  if(existing)return null;
  pending.eventSlug=event.slug;
  pending.eventTitle=event.title;
  pending.eventDate=event.date;
  pending.closesAt=contestCloseAt(event.date);
  pending.minParticipants=Math.min(50,Math.max(30,Number(event.arcadeMinParticipants)||30));
  pending.status=now<pending.closesAt?'open':'closed_pending';
  await pending.save();
  await ArcadeEntry.updateMany({contest:pending._id},{$set:{eventSlug:event.slug}});
  return pending;
}

export async function currentContest(now=new Date()){
  const settings=await arcadeSettings();
  if(!settings.enabled)return null;
  const upcomingEvents=await Event.find({
    active:{$ne:false},
    arcadeEnabled:{$ne:false},
    date:{$gt:now}
  }).sort({date:1}).lean();
  // Do not attach the holding leaderboard to an event whose reward window has
  // already closed. It remains live and follows the next eligible event.
  const events=upcomingEvents.filter(event=>hasOpenContestWindow(event.date,now));
  if(!events.length)return refreshContest(await pendingContest(settings,now),now);
  await attachPendingContest(events[0],now);
  let fallback=null;
  for(const event of events){
    const closesAt=contestCloseAt(event.date);
    const contest=await ArcadeContest.findOneAndUpdate({eventSlug:event.slug},{$set:{
      eventTitle:event.title,eventDate:event.date,closesAt,
      minParticipants:Math.min(50,Math.max(30,Number(event.arcadeMinParticipants)||30))
    },$setOnInsert:{opensAt:event.createdAt||now,status:now<closesAt?'open':'closed_pending'}},{upsert:true,new:true});
    const refreshed=await refreshContest(contest,now);
    fallback ||= refreshed;
    if(refreshed.status==='open')return refreshed;
  }
  return fallback;
}

export async function refreshContest(contest,now=new Date()){
  if(!contest)return null;
  const participantCount=await ArcadeEntry.countDocuments({contest:contest._id,bestScore:{$gt:0}});
  contest.participantCount=participantCount;
  if(contest.status==='finalized')return contest;
  if(contest.status==='finalizing'){
    if(now-new Date(contest.updatedAt)<10*60_000)return contest;
    contest.status='closed_pending';await contest.save();
  }
  if(now<contest.closesAt){contest.status='open';await contest.save();return contest;}
  if(participantCount<contest.minParticipants){contest.status='closed_pending';await contest.save();return contest;}
  return finalizeContest(contest);
}

export async function finalizeContest(contest){
  const claimed=await ArcadeContest.findOneAndUpdate({_id:contest._id,status:{$in:['open','closed_pending']}},{$set:{status:'finalizing'}},{new:true});
  if(!claimed)return ArcadeContest.findById(contest._id);
  const entries=await ArcadeEntry.find({contest:claimed._id,bestScore:{$gt:0}}).sort({bestScore:-1,bestAt:1,_id:1});
  for(let index=0;index<entries.length;index++){
    const entry=entries[index],rank=index+1,prize=prizeForRank(rank);
    entry.finalizedRank=rank;entry.rewardTier=prize.tier;
    if(!entry.rewardCode)entry.rewardCode=await uniqueClaimCode(prize.tier);
    entry.rewardEmailStatus='pending';await entry.save();
  }
  claimed.status='finalized';claimed.finalizedAt=new Date();claimed.participantCount=entries.length;await claimed.save();
  // Finalization is committed before delivery starts. A slow email provider
  // cannot hold the leaderboard request open or cause rewards to be issued twice.
  void Promise.allSettled(entries.map(entry=>deliverResult(entry,claimed)));
  return claimed;
}

async function uniqueClaimCode(tier){
  for(let attempt=0;attempt<8;attempt++){
    const code=claimCode(tier);
    const [entry,legacy]=await Promise.all([ArcadeEntry.exists({rewardCode:code}),Player.exists({rewardCode:code})]);
    if(!entry&&!legacy)return code;
  }
  throw new Error('Could not allocate a unique arcade reward code.');
}

async function deliverResult(entry,contest){
  const locked=await ArcadeEntry.findOneAndUpdate({_id:entry._id,rewardEmailStatus:{$in:['pending','failed']}},{$set:{rewardEmailStatus:'sending',rewardEmailError:null}},{new:true});
  if(!locked)return;
  try{
    const sent=await sendArcadeResultEmail({entry:locked,contest});
    await ArcadeEntry.updateOne({_id:locked._id},{$set:{rewardEmailStatus:sent.status,rewardEmailId:sent.id||null,rewardEmailSentAt:sent.status==='sent'?new Date():null}});
  }catch(error){
    await ArcadeEntry.updateOne({_id:locked._id},{$set:{rewardEmailStatus:'failed',rewardEmailError:String(error.message||error).slice(0,500)}});
  }
}

export async function retryArcadeResultEmails(now=new Date()){
  const contests=await ArcadeContest.find({status:'finalized',eventDate:{$gt:now}}).select('_id eventSlug eventTitle eventDate').lean();
  if(!contests.length)return;
  const byId=new Map(contests.map(contest=>[String(contest._id),contest]));
  const entries=await ArcadeEntry.find({contest:{$in:contests.map(c=>c._id)},rewardEmailStatus:{$in:['pending','failed']}}).limit(50);
  await Promise.allSettled(entries.map(entry=>deliverResult(entry,byId.get(String(entry.contest)))));
}

export const contestPublic=contest=>contest?{
  id:String(contest._id),assigned:contest.eventSlug!==PENDING_EVENT_SLUG,
  eventSlug:contest.eventSlug===PENDING_EVENT_SLUG?null:contest.eventSlug,
  eventTitle:contest.eventTitle,eventDate:contest.eventSlug===PENDING_EVENT_SLUG?null:contest.eventDate,
  opensAt:contest.opensAt,closesAt:contest.eventSlug===PENDING_EVENT_SLUG?null:contest.closesAt,status:contest.status,
  minParticipants:contest.minParticipants,participantCount:contest.participantCount,finalizedAt:contest.finalizedAt,
  entriesNeeded:Math.max(0,contest.minParticipants-contest.participantCount)
}:null;

export async function entryFor(contest,player,{create=false}={}){
  if(!contest||!player)return null;
  let entry=await ArcadeEntry.findOne({contest:contest._id,player:player._id});
  if(!entry&&create)entry=await ArcadeEntry.create({contest:contest._id,eventSlug:contest.eventSlug,player:player._id,handle:player.handle,email:player.email});
  else if(entry&&(entry.handle!==player.handle||entry.email!==player.email)){entry.handle=player.handle;entry.email=player.email;await entry.save();}
  return entry;
}
