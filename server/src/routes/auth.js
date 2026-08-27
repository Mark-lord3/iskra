import { Router } from 'express';
import { authenticate, clearSessionCookie, hashPassword,
         requireAdmin, setSessionCookie } from '../lib/adminAuth.js';

const r = Router();
const publicAdmin = a => ({ id:a._id, email:a.email, name:a.name, role:a.role, lastLoginAt:a.lastLoginAt });

r.post('/login', async (req,res,next)=>{
  try{
    const result = await authenticate(req.body.email, req.body.password);
    if(!result.ok){
      if(result.code === 'LOCKED')
        return res.status(423).json({
          error:`Too many attempts. Try again in ${Math.ceil((result.retryAfterMs||0)/60000)} minutes.`,
          code:'LOCKED'
        });
      // Never reveal whether the address exists.
      return res.status(401).json({ error:'Email or password is incorrect.', code:'BAD_CREDENTIALS' });
    }
    setSessionCookie(res, result.admin);
    res.json({ admin: publicAdmin(result.admin) });
  }catch(e){ next(e); }
});

r.post('/logout', (req,res)=>{ clearSessionCookie(res); res.json({ ok:true }); });

r.get('/me', requireAdmin, (req,res)=> res.json({ admin: publicAdmin(req.admin) }));

r.post('/password', requireAdmin, async (req,res,next)=>{
  try{
    const next_ = String(req.body.password || '');
    if(next_.length < 10)
      return res.status(400).json({ error:'Use at least 10 characters.', code:'WEAK' });
    const check = await authenticate(req.admin.email, req.body.currentPassword);
    if(!check.ok) return res.status(401).json({ error:'Current password is incorrect.', code:'BAD_CREDENTIALS' });

    req.admin.passwordHash = await hashPassword(next_);
    req.admin.passwordChangedAt = new Date();   // invalidates other sessions
    await req.admin.save();
    setSessionCookie(res, req.admin);           // keep this device signed in
    res.json({ ok:true });
  }catch(e){ next(e); }
});

export default r;
