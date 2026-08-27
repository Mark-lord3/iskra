// Prize tiers for the Spark Rush leaderboard.
// Rank is recomputed live; the tier a player has earned is never downgraded,
// but the season-end standings decide the actual winners.
export const PRIZES = {
  top1:   {tier:'top1',off:1,label:'First place, one free ticket',maxQty:1,head:'Free ticket',sub:'First place earns one free ticket for this event.'},
  top2:   {tier:'top2',off:.50,label:'Second place, 50% off',maxQty:1,head:'50% off',sub:'Second place earns 50% off one ticket for this event.'},
  top5:   {tier:'top5',off:.40,label:'Third to fifth, 40% off',maxQty:1,head:'40% off',sub:'Third to fifth place earn 40% off one ticket for this event.'},
  played: {tier:'played',off:.10,label:'Thanks for playing, 10% off',maxQty:1,head:'10% off',sub:'Every other qualified player earns 10% off one ticket.'}
};
export const TIER_ORDER = ['played','top5','top2','top1'];
export const prizeForRank = r => r === 1 ? PRIZES.top1 : r === 2 ? PRIZES.top2 : r <= 5 ? PRIZES.top5 : PRIZES.played;
export const isUpgrade = (next,current) =>
  !current || TIER_ORDER.indexOf(next) > TIER_ORDER.indexOf(current);

const ALPHA='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const claimCode = tier => {
  const p=tier==='top1'?'ISKRAFREE':tier==='top2'?'ISKRA50':tier==='top5'?'ISKRA40':'PLAYED10';
  let s=''; for(let i=0;i<4;i++) s+=ALPHA[Math.floor(Math.random()*ALPHA.length)];
  return p+'-'+s;
};
