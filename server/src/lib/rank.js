import Player from '../models/Player.js';

// Rank = players with a higher best score, plus those tied but who got there first.
export async function rankOf(player){
  if(!player.bestScore) return null;
  const higher = await Player.countDocuments({ bestScore:{ $gt: player.bestScore } });
  const tiedEarlier = await Player.countDocuments({
    bestScore: player.bestScore,
    bestAt: { $lt: player.bestAt },
    _id: { $ne: player._id }
  });
  return higher + tiedEarlier + 1;
}
