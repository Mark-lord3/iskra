import { Router } from 'express';
import Player from '../models/Player.js';
import { rankOf } from '../lib/rank.js';

const r = Router();
// Rows outside the prize zone get no label rather than a placeholder dash.
const prizeLabel = rank => rank === 1 ? '$10 ticket' : rank <= 5 ? '50% off' : '';

r.get('/', async (req,res,next)=>{
  try{
    const limit = Math.min(50, Math.max(3, parseInt(req.query.limit) || 10));
    const rows = await Player.find({ bestScore:{ $gt:0 } })
      .sort({ bestScore:-1, bestAt:1 }).limit(limit)
      .select('handle bestScore bestAt').lean();

    const board = rows.map((p,i)=>({
      id:String(p._id), rank:i+1, handle:p.handle, score:p.bestScore, prize:prizeLabel(i+1)
    }));

    // If the caller is outside the visible top N, append their own row.
    let me = null;
    if(req.query.playerId){
      const inBoard = board.find(b=>b.id===req.query.playerId);
      if(inBoard) me = inBoard;
      else {
        const p = await Player.findById(req.query.playerId).select('handle bestScore bestAt');
        if(p && p.bestScore > 0){
          const rank = await rankOf(p);
          me = { id:p.id, rank, handle:p.handle, score:p.bestScore, prize:prizeLabel(rank) };
        }
      }
    }
    res.json({ board, me, total: await Player.countDocuments({ bestScore:{ $gt:0 } }) });
  }catch(e){ next(e); }
});

export default r;
