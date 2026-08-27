import {Router} from 'express';
import QRCode from 'qrcode';
import Stripe from 'stripe';
import AccountToken from '../models/AccountToken.js';
import Event from '../models/Event.js';
import Membership from '../models/Membership.js';
import Order from '../models/Order.js';
import Subscriber from '../models/Subscriber.js';
import Ticket from '../models/Ticket.js';
import User from '../models/User.js';
import UserSession from '../models/UserSession.js';
import {clearSessionCookie,createSession,hashPassword,hashToken,optionalAccount,publicUser,randomToken,requireAccount,requireCsrf,verifyPassword} from '../lib/accountAuth.js';
import {sendAccountEmail} from '../services/accountEmail.js';

const r=Router();
const EMAIL=/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
const safeLocale=value=>['en','uk','ru'].includes(value)?value:'en';
const baseUrl=req=>{
  const configured=String(process.env.CLIENT_ORIGIN||'').split(',').map(v=>v.trim()).find(Boolean);
  return configured||`${req.protocol}://${req.get('host')}`;
};
const stripe=()=>{
  if(!process.env.STRIPE_SECRET_KEY)throw Object.assign(new Error('Stripe memberships are not configured.'),{status:503});
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};
const actionToken=async(user,purpose,minutes)=>{
  await AccountToken.deleteMany({userId:user._id,purpose,usedAt:null});
  const raw=randomToken();
  await AccountToken.create({userId:user._id,purpose,tokenHash:hashToken(raw),expiresAt:new Date(Date.now()+minutes*60_000)});
  return raw;
};
const claimPurchases=async user=>{
  if(!user.emailVerifiedAt)return;
  await Promise.all([
    Order.updateMany({email:user.email,userId:null},{$set:{userId:user._id}}),
    Ticket.updateMany({buyerEmail:user.email,userId:null},{$set:{userId:user._id}})
  ]);
};
const issueActionEmail=async(req,user,purpose)=>{
  const raw=await actionToken(user,purpose,purpose==='verify'?24*60:30);
  const parameter=purpose==='verify'?'verify':'reset';
  const url=`${baseUrl(req)}/account?${parameter}=${encodeURIComponent(raw)}`;
  await sendAccountEmail({to:user.email,name:user.name,locale:user.locale,kind:purpose,url,idempotencyKey:`account/${purpose}/${hashToken(raw).slice(0,24)}`});
};

r.use(optionalAccount);

r.post('/register',async(req,res,next)=>{
  try{
    const email=String(req.body.email||'').trim().toLowerCase();
    const name=String(req.body.name||'').trim().slice(0,100);
    const password=String(req.body.password||'');
    if(!EMAIL.test(email)||name.length<2||password.length<10||password.length>128)
      return res.status(400).json({error:'Enter a name, valid email, and a password of at least 10 characters.'});
    let user=await User.findOne({email});
    if(!user){
      user=await User.create({email,name,passwordHash:await hashPassword(password),locale:safeLocale(req.body.locale),preferences:{newsletter:Boolean(req.body.newsletter)}});
      if(req.body.newsletter)await Subscriber.updateOne({email},{$setOnInsert:{source:'account'}},{upsert:true});
      await issueActionEmail(req,user,'verify').catch(error=>console.error('Verification email failed:',error.message));
    }
    res.status(202).json({ok:true,message:'If this address can be registered, a verification email is on its way.'});
  }catch(error){next(error);}
});

r.post('/login',async(req,res,next)=>{
  try{
    const email=String(req.body.email||'').trim().toLowerCase();
    const user=await User.findOne({email,status:'active'}).select('+passwordHash');
    if(!user||!await verifyPassword(String(req.body.password||''),user.passwordHash))
      return res.status(401).json({error:'Email or password is incorrect.',code:'INVALID_CREDENTIALS'});
    await UserSession.deleteMany({userId:user._id,expiresAt:{$lte:new Date()}});
    const session=await createSession(req,res,user);
    user.lastLoginAt=new Date();await user.save();await claimPurchases(user);
    res.json({user:publicUser(user),csrfToken:session.csrfToken});
  }catch(error){next(error);}
});

r.get('/me',requireAccount,(req,res)=>res.json({user:publicUser(req.account),csrfToken:req.accountSession.csrfToken}));
r.post('/logout',requireAccount,requireCsrf,async(req,res,next)=>{try{await UserSession.deleteOne({_id:req.accountSession._id});clearSessionCookie(res);res.json({ok:true});}catch(error){next(error);}});

r.post('/verify',async(req,res,next)=>{
  try{
    const token=await AccountToken.findOneAndUpdate({tokenHash:hashToken(req.body.token),purpose:'verify',usedAt:null,expiresAt:{$gt:new Date()}},{$set:{usedAt:new Date()}},{new:true});
    if(!token)return res.status(400).json({error:'This verification link is invalid or expired.'});
    const user=await User.findByIdAndUpdate(token.userId,{$set:{emailVerifiedAt:new Date()}},{new:true});
    await claimPurchases(user);
    const session=await createSession(req,res,user);
    await sendAccountEmail({to:user.email,name:user.name,locale:user.locale,kind:'welcome',url:`${baseUrl(req)}/account`,idempotencyKey:`account/welcome/${user._id}`}).catch(()=>{});
    res.json({user:publicUser(user),csrfToken:session.csrfToken});
  }catch(error){next(error);}
});

r.post('/forgot-password',async(req,res,next)=>{
  try{
    const user=await User.findOne({email:String(req.body.email||'').trim().toLowerCase(),status:'active'});
    if(user)await issueActionEmail(req,user,'reset').catch(error=>console.error('Reset email failed:',error.message));
    res.json({ok:true,message:'If an account exists, a reset link has been sent.'});
  }catch(error){next(error);}
});
r.post('/reset-password',async(req,res,next)=>{
  try{
    const password=String(req.body.password||'');
    if(password.length<10||password.length>128)return res.status(400).json({error:'Use a password between 10 and 128 characters.'});
    const token=await AccountToken.findOneAndUpdate({tokenHash:hashToken(req.body.token),purpose:'reset',usedAt:null,expiresAt:{$gt:new Date()}},{$set:{usedAt:new Date()}},{new:true});
    if(!token)return res.status(400).json({error:'This reset link is invalid or expired.'});
    await User.findByIdAndUpdate(token.userId,{$set:{passwordHash:await hashPassword(password)}});
    await UserSession.deleteMany({userId:token.userId});
    clearSessionCookie(res);res.json({ok:true});
  }catch(error){next(error);}
});

r.get('/overview',requireAccount,async(req,res,next)=>{
  try{
    const [orders,tickets,events,membership]=await Promise.all([
      Order.find({userId:req.account._id}).sort({createdAt:-1}).lean(),
      Ticket.find({userId:req.account._id}).select('+qrPayload').sort({eventDate:-1}),
      Event.find({active:{$ne:false}}).sort({date:1}).lean(),
      Membership.findOne({userId:req.account._id}).lean()
    ]);
    const publicTickets=await Promise.all(tickets.map(async ticket=>({
      id:ticket._id,reference:ticket.reference,eventSlug:ticket.eventSlug,eventTitle:ticket.eventTitle,
      eventDate:ticket.eventDate,room:ticket.room,buyerName:ticket.buyerName,tier:ticket.tier,
      price:ticket.price,status:ticket.status,redeemedAt:ticket.redeemedAt,
      qrDataUrl:await QRCode.toDataURL(ticket.qrPayload,{width:520,margin:2,errorCorrectionLevel:'M'})
    })));
    res.json({user:publicUser(req.account),orders:orders.map(o=>({id:o._id,eventSlug:o.eventSlug,tier:o.tier,qty:o.qty,total:o.total,currency:o.currency,paymentStatus:o.paymentStatus,status:o.status,emailStatus:o.emailStatus,createdAt:o.createdAt})),tickets:publicTickets,events:events.map(e=>({id:e.slug,slug:e.slug,title:e.title,date:e.date,room:e.room,image:e.image,from:e.from,saved:req.account.savedEvents.includes(e.slug)})),membership:membership||{status:'inactive',plan:'ISKRA Circle'}});
  }catch(error){next(error);}
});

r.post('/claim-tickets',requireAccount,requireCsrf,async(req,res,next)=>{
  try{
    if(!req.account.emailVerifiedAt)return res.status(403).json({error:'Verify your email before claiming tickets.'});
    const credentials=Array.isArray(req.body.tickets)?req.body.tickets.slice(0,30):[];
    let claimed=0;
    for(const item of credentials){
      const ticket=await Ticket.findOne({reference:String(item.reference||''),accessToken:String(item.accessToken||''),buyerEmail:req.account.email});
      if(ticket){ticket.userId=req.account._id;await ticket.save();if(ticket.orderId)await Order.updateOne({_id:ticket.orderId,email:req.account.email},{$set:{userId:req.account._id}});claimed+=1;}
    }
    res.json({ok:true,claimed});
  }catch(error){next(error);}
});

r.patch('/profile',requireAccount,requireCsrf,async(req,res,next)=>{try{const name=String(req.body.name||'').trim().slice(0,100);if(name.length<2)return res.status(400).json({error:'Enter your name.'});req.account.name=name;req.account.locale=safeLocale(req.body.locale||req.account.locale);await req.account.save();res.json({user:publicUser(req.account)});}catch(error){next(error);}});
r.patch('/preferences',requireAccount,requireCsrf,async(req,res,next)=>{try{for(const key of ['newsletter','eventReminders','offers','productUpdates'])if(typeof req.body[key]==='boolean')req.account.preferences[key]=req.body[key];await req.account.save();if(req.account.preferences.newsletter)await Subscriber.updateOne({email:req.account.email},{$setOnInsert:{source:'account'}},{upsert:true});else await Subscriber.deleteOne({email:req.account.email});res.json({preferences:req.account.preferences});}catch(error){next(error);}});
r.post('/saved-events/:slug',requireAccount,requireCsrf,async(req,res,next)=>{try{const slug=String(req.params.slug);const saved=req.account.savedEvents.includes(slug);await User.updateOne({_id:req.account._id},saved?{$pull:{savedEvents:slug}}:{$addToSet:{savedEvents:slug}});res.json({saved:!saved});}catch(error){next(error);}});

r.post('/membership/checkout',requireAccount,requireCsrf,async(req,res,next)=>{try{if(!process.env.STRIPE_MEMBERSHIP_PRICE_ID)return res.status(503).json({error:'Membership enrollment is not available yet.'});let customerId=req.account.stripeCustomerId;if(!customerId){const customer=await stripe().customers.create({email:req.account.email,name:req.account.name,metadata:{userId:String(req.account._id)}});customerId=customer.id;req.account.stripeCustomerId=customerId;await req.account.save();}const session=await stripe().checkout.sessions.create({mode:'subscription',customer:customerId,line_items:[{price:process.env.STRIPE_MEMBERSHIP_PRICE_ID,quantity:1}],success_url:`${baseUrl(req)}/account#membership`,cancel_url:`${baseUrl(req)}/account#membership`,metadata:{userId:String(req.account._id)}});res.json({checkoutUrl:session.url});}catch(error){next(error);}});
r.post('/membership/portal',requireAccount,requireCsrf,async(req,res,next)=>{try{if(!req.account.stripeCustomerId)return res.status(409).json({error:'No billing account is connected.'});const session=await stripe().billingPortal.sessions.create({customer:req.account.stripeCustomerId,return_url:`${baseUrl(req)}/account#membership`});res.json({url:session.url});}catch(error){next(error);}});

r.delete('/',requireAccount,requireCsrf,async(req,res,next)=>{try{const password=String(req.body.password||'');const user=await User.findById(req.account._id).select('+passwordHash');if(!await verifyPassword(password,user.passwordHash))return res.status(403).json({error:'Password confirmation failed.'});await User.updateOne({_id:user._id},{$set:{email:`deleted+${user._id}@invalid.local`,name:'Deleted member',passwordHash:await hashPassword(randomToken()),status:'deleted',deletedAt:new Date(),preferences:{newsletter:false,eventReminders:false,offers:false,productUpdates:false},savedEvents:[]}});await Promise.all([UserSession.deleteMany({userId:user._id}),AccountToken.deleteMany({userId:user._id}),Subscriber.deleteOne({email:user.email})]);clearSessionCookie(res);res.json({ok:true});}catch(error){next(error);}});

export default r;
