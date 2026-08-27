import { Router } from 'express';
import Player from '../models/Player.js';
import ArcadeEntry from '../models/ArcadeEntry.js';
import {currentContest,contestPublic,entryFor} from '../lib/arcadeContest.js';

const r = Router();

/* Prize tier is a property of the rank, so it is computed here rather than
   stored on the row. */
const prizeTier = rank => rank === 1 ? 'top1' : rank === 2 ? 'top2' : rank <= 5 ? 'top5' : 'played';

/* Only ever these fields leave the database: no email, no token, no play log. */
const row = (p, rank) => ({
  id:String(p.player||p._id),
  rank,
  handle: p.handle,
  score: p.bestScore,
  achievedAt: p.bestAt,
  tier: prizeTier(rank)
});

r.get('/', async (req,res,next)=>{
  try{
    const limit = Math.min(50, Math.max(3, parseInt(req.query.limit) || 10));

    // Highest score first; on a tie the player who got there first ranks above.
    const contest=await currentContest();
    if(!contest)return res.json({board:[],me:null,total:0,updatedAt:new Date(),contest:null});
    const rows = await ArcadeEntry.find({contest:contest._id,bestScore:{$gt:0}})
      .sort({ bestScore:-1, bestAt:1 })
      .limit(limit)
      .select('player handle bestScore bestAt')
      .lean();

    const board = rows.map((p,i)=>row(p,i+1));

    // The caller's own standing, so a player outside the visible top N still
    // sees exactly where they are.
    let me = null;
    if(req.query.playerId && /^[a-f0-9]{24}$/i.test(req.query.playerId)){
      const inBoard=board.find(b=>b.id===req.query.playerId);
      if(inBoard) me = { ...inBoard, inTop:true };
      else {
        const player=await Player.findById(req.query.playerId).lean();
        const p=player?await entryFor(contest,player):null;
        if(p&&p.bestScore>0){
          const higher=await ArcadeEntry.countDocuments({contest:contest._id,$or:[{bestScore:{$gt:p.bestScore}},{bestScore:p.bestScore,bestAt:{$lt:p.bestAt}}]});
          me={...row(p,higher+1),inTop:false};
        }else if(player){
          me={id:String(player._id),rank:null,handle:player.handle,score:0,achievedAt:null,tier:null,inTop:false};
        }
      }
    }

    res.json({
      board, me,
      total:contest.participantCount,updatedAt:new Date(),contest:contestPublic(contest)
    });
  }catch(e){ next(e); }
});

export default r;
