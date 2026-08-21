// Prize tiers for the Spark Rush leaderboard.
// Rank is recomputed live; the tier a player has earned is never downgraded,
// but the season-end standings decide the actual winners.
export const PRIZES = {
  top1:   { tier:'top1',   flat:10,  label:'Champion, $10 flat ticket',      maxQty:1, head:'$10 flat ticket',
            sub:'You are #1. Any night, any tier, ten dollars.' },
  top5:   { tier:'top5',   off:0.50, label:'Leaderboard top five, 50% off',     maxQty:2, head:'50% off',
            sub:'Top five. Half price on up to two tickets.' },
  played: { tier:'played', off:0.10, label:'Thanks for playing, 10% off',    maxQty:4, head:'10% off',
            sub:'Not top five yet. You still get 10% for playing.' }
};
export const TIER_ORDER = ['played','top5','top1'];
export const prizeForRank = r => r === 1 ? PRIZES.top1 : r <= 5 ? PRIZES.top5 : PRIZES.played;
export const isUpgrade = (next,current) =>
  !current || TIER_ORDER.indexOf(next) > TIER_ORDER.indexOf(current);

const ALPHA='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const claimCode = tier => {
  const p = tier==='top1' ? 'ISKRA10' : tier==='top5' ? 'ISKRA50' : 'PLAYED10';
  let s=''; for(let i=0;i<4;i++) s+=ALPHA[Math.floor(Math.random()*ALPHA.length)];
  return p+'-'+s;
};
