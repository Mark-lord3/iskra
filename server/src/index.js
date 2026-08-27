import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { connectDB } from './db.js';
import events from './routes/events.js';
import players from './routes/players.js';
import scores from './routes/scores.js';
import {currentContest,retryArcadeResultEmails} from './lib/arcadeContest.js';
import leaderboard from './routes/leaderboard.js';
import promo from './routes/promo.js';
import misc from './routes/misc.js';
import contact from './routes/contact.js';
import analytics from './routes/analytics.js';
import admin from './routes/admin.js';
import staff from './routes/staff.js';
import auth from './routes/auth.js';
import cookieParser from 'cookie-parser';
import { seedFirstAdmin } from './lib/adminAuth.js';
import tickets, { stripeWebhook } from './routes/tickets.js';
import site from './routes/site.js';
import feedback from './routes/feedback.js';
import account from './routes/account.js';
import campaigns from './routes/campaigns.js';
import { retryFailedTicketEmails } from './services/ticketEmail.js';
import poker from './routes/poker.js';
import adminPoker from './routes/adminPoker.js';
import { hub } from './realtime/hub.js';
import { engine } from './poker/runtime.js';
import { wirePoker } from './poker/wiring.js';
import { accountFromCookieHeader } from './lib/accountAuth.js';
import Seat from './models/PokerSeat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',').map(s=>s.trim()).filter(Boolean);
const isLocalDevOrigin = origin => process.env.NODE_ENV !== 'production'
  && /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || '');

app.set('trust proxy', 1);
app.use(cors({ credentials:true, origin:(origin,cb)=>{
  if(!origin || origins.includes(origin) || isLocalDevOrigin(origin)) return cb(null,true);
  const error = new Error('Origin not allowed: '+origin);
  error.status = 403;
  cb(error);
} }));
app.use((req,res,next)=>{
  req.requestId=req.get('x-request-id') || randomUUID();
  res.set('x-request-id',req.requestId);
  next();
});
app.post('/api/tickets/webhook', express.raw({type:'application/json'}), stripeWebhook);
app.use(cookieParser());
app.use(express.json({ limit:'32kb' }));

const rateLimitHandler=(req,res,_next,options)=>{
  const resetAt=req.rateLimit?.resetTime?.getTime?.() || Date.now()+options.windowMs;
  const retryAfter=Math.max(1,Math.ceil((resetAt-Date.now())/1000));
  res.status(options.statusCode).json({
    error:`Too many requests. Try again in ${retryAfter} seconds.`,
    code:'RATE_LIMITED',retryAfter,requestId:req.requestId
  });
};
const limiter = rateLimit({
  windowMs:60_000,
  max:Number(process.env.RATE_LIMIT_MAX) || (process.env.NODE_ENV === 'production' ? 300 : 2000),
  standardHeaders:true,legacyHeaders:false,handler:rateLimitHandler,
  skip:req=>req.method === 'OPTIONS' || req.originalUrl === '/api/health' || req.originalUrl.startsWith('/api/analytics')
});
const writeLimiter = rateLimit({
  windowMs:60_000,max:Number(process.env.WRITE_RATE_LIMIT_MAX) || 30,
  standardHeaders:true,legacyHeaders:false,handler:rateLimitHandler,
  skip:req=>['GET','HEAD','OPTIONS'].includes(req.method)
});
const analyticsLimiter = rateLimit({
  windowMs:60_000,max:300,standardHeaders:true,legacyHeaders:false,handler:rateLimitHandler
});
app.use('/api', limiter);
app.use(['/api/players','/api/scores','/api/subscribe','/api/orders','/api/contact','/api/tickets/checkout'], writeLimiter);

app.get('/api/health', (_req,res)=>res.json({
  ok:true,service:'iskra-promo',
  integrations:{
    stripe:Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    resend:Boolean(process.env.RESEND_API_KEY)
  }
}));
app.get('/api/public-config', (_req,res)=>res.json({
  stripePublishableKey:process.env.STRIPE_PUBLISHABLE_KEY || null
}));
app.use('/api/events', events);
app.use('/api/players', players);
app.use('/api/scores', scores);
app.use('/api/leaderboard', leaderboard);
app.use('/api/promo', promo);
app.use('/api/contact', contact);
app.use('/api/analytics', analyticsLimiter, analytics);
/* The door API gets its own budget: generous enough for a busy entrance,
   tight enough that a stolen device token cannot be used to enumerate. */
const scannerLimiter = rateLimit({
  windowMs:60_000, max:240, standardHeaders:true, legacyHeaders:false, handler:rateLimitHandler
});
const scannerSessionLimiter = rateLimit({
  windowMs:60_000, max:12, standardHeaders:true, legacyHeaders:false, handler:rateLimitHandler
});
app.use('/api/staff/session', scannerSessionLimiter);
app.use('/api/staff', scannerLimiter, staff);

/* Sign-in is deliberately slow to guess: a tight window on top of the
   per-account lockout. */
const loginLimiter = rateLimit({
  windowMs:15*60_000, max:Number(process.env.ADMIN_LOGIN_RATE_LIMIT_MAX || 10),
  standardHeaders:true, legacyHeaders:false, handler:rateLimitHandler
});
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', auth);

/* Table actions arrive fast during a hand, so poker gets its own budget
   rather than competing with the general write limit. */
const pokerLimiter = rateLimit({
  windowMs:60_000, max:600, standardHeaders:true, legacyHeaders:false, handler:rateLimitHandler
});
app.use('/api/poker', pokerLimiter, poker);
app.use('/api/admin/poker', adminPoker);
app.use('/api/admin', admin);
app.use('/api/account', account);
app.use('/api/campaigns', campaigns);
app.use('/api/tickets', tickets);
app.use('/api/feedback', writeLimiter, feedback);
app.use('/api', site);
app.use('/api', misc);
app.use('/api', (req,res)=>res.status(404).json({
  error:'API endpoint not found.',code:'NOT_FOUND',requestId:req.requestId
}));

// Serve the built React app in production (single-origin deploy on iskra.orvadora.com)
const dist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(dist));
app.get(/^(?!\/api).*/, (_req,res)=>res.sendFile(path.join(dist,'index.html')));

app.use((err,req,res,_next)=>{
  const malformedJson=err instanceof SyntaxError && err.status === 400 && 'body' in err;
  const status=malformedJson ? 400 : Number(err.status || err.statusCode) || 500;
  const code=malformedJson ? 'INVALID_JSON' : status === 403 ? 'ORIGIN_NOT_ALLOWED' : status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED';
  console.error(`[${req.requestId || 'no-request-id'}] ${req.method} ${req.originalUrl}`,err);
  res.status(status).json({
    error:malformedJson ? 'Request body contains invalid JSON.' : status >= 500 && process.env.NODE_ENV === 'production' ? 'The server could not complete this request.' : err.message || 'Server error',
    code,requestId:req.requestId || null
  });
});

connectDB(process.env.MONGODB_URI)
  .then(()=>seedFirstAdmin())
  .then(()=>{
    const maintainArcade=()=>currentContest().then(()=>retryArcadeResultEmails()).catch(error=>console.error('Arcade contest maintenance failed:',error.message));
    void maintainArcade();
    setInterval(maintainArcade,60_000).unref();
    const server=app.listen(PORT,()=>console.log('  ✓ ISKRA API on http://localhost:%s',PORT));

    /* Live poker: the hub carries updates, the engine owns the truth. Every
       socket is authenticated from the session cookie and may only join a
       table it is actually seated at. */
    hub.attach(server,{
      path:'/ws/poker',
      resolveViewer:async (req,tableId)=>{
        const user=await accountFromCookieHeader(req.headers.cookie);
        if(!user)return null;
        const seat=await Seat.findOne({table:tableId,user:user._id}).lean();
        if(!seat)return null;   // spectating another table is not allowed
        return {userId:String(user._id),name:user.name,seatIndex:seat.seatIndex};
      },
      snapshot:(tableId,userId)=>engine.stateFor(tableId,userId)
    });
    hub.onPresence=(tableId,viewer,connected)=>engine.setPresence(tableId,viewer.userId,connected);
    hub.onIntent=async (ws,msg)=>{
      if(msg?.type==='action'){
        const outcome=await engine.act(ws.tableId,ws.viewer.userId,msg);
        if(!outcome.ok)hub.sendTo(ws,{event:'rejected',code:outcome.code,
          state:engine.stateFor(ws.tableId,ws.viewer.userId)});
      }
      if(msg?.type==='sitOut')engine.setSitOut(ws.tableId,ws.viewer.userId,msg.sitOut===true);
    };
    engine.broadcast=(tableId,message)=>hub.publish(tableId,message);
    wirePoker();
    engine.start().catch(error=>console.error('  ✗ Poker engine failed to start:',error.message));
    const emailRetryTimer=setInterval(()=>{
      retryFailedTicketEmails().catch(error=>console.error('  ✗ Ticket email retry failed:',error.message));
    },5*60_000);
    emailRetryTimer.unref();
    server.on('error',error=>{
      if(error.code === 'EADDRINUSE'){
        console.error(`  ✗ Port ${PORT} is already in use. Stop the other ISKRA API process and retry.`);
      }else{
        console.error('  ✗ API listener failed:',error.message);
      }
      process.exit(1);
    });
  })
  .catch(error=>{ console.error('  ✗ Startup failed:',error.message); process.exit(1); });
