import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { connectDB } from './db.js';
import events from './routes/events.js';
import players from './routes/players.js';
import scores from './routes/scores.js';
import leaderboard from './routes/leaderboard.js';
import promo from './routes/promo.js';
import misc from './routes/misc.js';
import contact from './routes/contact.js';
import analytics from './routes/analytics.js';
import admin from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',').map(s=>s.trim()).filter(Boolean);

app.set('trust proxy', 1);
app.use(cors({ origin:(origin,cb)=> !origin || origins.includes(origin) ? cb(null,true)
                                   : cb(new Error('Origin not allowed: '+origin)) }));
app.use(express.json({ limit:'32kb' }));

const limiter = rateLimit({ windowMs:60_000, max:120, standardHeaders:true, legacyHeaders:false });
const writeLimiter = rateLimit({ windowMs:60_000, max:20, standardHeaders:true, legacyHeaders:false });
app.use('/api', limiter);
app.use(['/api/players','/api/scores','/api/subscribe','/api/orders'], writeLimiter);

app.get('/api/health', (_req,res)=>res.json({ok:true, service:'iskra-promo'}));
app.use('/api/events', events);
app.use('/api/players', players);
app.use('/api/scores', scores);
app.use('/api/leaderboard', leaderboard);
app.use('/api/promo', promo);
app.use('/api/contact', contact);
app.use('/api/analytics', analytics);
app.use('/api/admin', admin);
app.use('/api', misc);

// Serve the built React app in production (single-origin deploy on iskra.orvadora.com)
const dist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(dist));
app.get(/^(?!\/api).*/, (_req,res)=>res.sendFile(path.join(dist,'index.html')));

app.use((err,_req,res,_next)=>{
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

connectDB(process.env.MONGODB_URI)
  .then(()=>app.listen(PORT, ()=>console.log('  ✓ ISKRA API on http://localhost:%s', PORT)))
  .catch(e=>{ console.error('  ✗ Startup failed:', e.message); process.exit(1); });
