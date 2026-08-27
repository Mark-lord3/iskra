import crypto from 'node:crypto';
import {Router} from 'express';
import Campaign from '../models/Campaign.js';
import CampaignExposure from '../models/CampaignExposure.js';
import ConsentEvent from '../models/ConsentEvent.js';
import {optionalAccount} from '../lib/accountAuth.js';

const r=Router();
const COOKIE='iskra_visitor';
const secret=()=>process.env.VISITOR_SIGNING_SECRET||process.env.ADMIN_KEY||'iskra-local-visitor-secret';
const sign=id=>crypto.createHmac('sha256',secret()).update(id).digest('base64url');
const cookieMap=req=>Object.fromEntries(String(req.get('cookie')||'').split(';').map(v=>v.trim().split(/=(.*)/s)).filter(([k])=>k));
const visitor=(req,res)=>{
  const raw=decodeURIComponent(cookieMap(req)[COOKIE]||'');
  let [id,signature]=raw.split('.');
  const expected=id?sign(id):'';
  if(!id||!signature||signature.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected))){
    id=crypto.randomBytes(24).toString('base64url');signature=sign(id);
    res.cookie(COOKIE,`${id}.${signature}`,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:365*86400_000});
  }
  return crypto.createHash('sha256').update(id).digest('hex');
};
const localeValue=(map,locale)=>map?.get?.(locale)||map?.get?.('en')||map?.[locale]||map?.en||'';
export const campaignEligible=({authenticated=false,totalImpressions=0,exposure=null,frequencyCap=1}={})=>{
  const history=exposure||{};
  return (authenticated||totalImpressions<5)&&!history.convertedAt&&(history.dismissals||0)<2&&(history.impressions||0)<frequencyCap;
};
const hasOptionalConsent=async visitorHash=>(await ConsentEvent.findOne({visitorHash}).sort({createdAt:-1}).lean())?.choice==='granted';
r.use(optionalAccount);

r.post('/consent',async(req,res,next)=>{try{const choice=req.body.choice==='granted'?'granted':'essential';const visitorHash=visitor(req,res);await ConsentEvent.create({visitorHash,userId:req.account?._id||null,choice});res.json({ok:true,choice});}catch(error){next(error);}});
r.get('/next',async(req,res,next)=>{
  try{
    if(req.get('sec-gpc')==='1'||String(req.get('dnt'))==='1')return res.json({campaign:null});
    const visitorHash=visitor(req,res);const now=new Date();
    if(!await hasOptionalConsent(visitorHash))return res.json({campaign:null});
    const total=await CampaignExposure.aggregate([{$match:{visitorHash}},{$group:{_id:null,count:{$sum:'$impressions'}}}]);
    const audience=req.account?'authenticated':'anonymous';
    if(!req.account&&(total[0]?.count||0)>=5)return res.json({campaign:null,capReached:true});
    const campaigns=await Campaign.find({active:true,placement:'popup',audience:{$in:[audience,'all']},$and:[{$or:[{startsAt:null},{startsAt:{$lte:now}}]},{$or:[{endsAt:null},{endsAt:{$gte:now}}]}]}).sort({priority:-1,createdAt:1});
    for(const campaign of campaigns){
      const exposure=await CampaignExposure.findOne({visitorHash,campaignId:campaign._id}).lean();
      if(!campaignEligible({authenticated:Boolean(req.account),totalImpressions:total[0]?.count||0,exposure,frequencyCap:campaign.frequencyCap}))continue;
      const locale=['en','uk','ru'].includes(req.query.locale)?req.query.locale:'en';
      return res.json({campaign:{id:campaign._id,key:campaign.key,title:localeValue(campaign.title,locale),text:localeValue(campaign.text,locale),cta:localeValue(campaign.cta,locale),href:campaign.href,variant:campaign.variant}});
    }
    res.json({campaign:null});
  }catch(error){next(error);}
});
const record=kind=>async(req,res,next)=>{try{const visitorHash=visitor(req,res);if(!await hasOptionalConsent(visitorHash))return res.status(403).json({error:'Optional analytics consent is required.'});const campaign=await Campaign.findById(req.params.id).lean();if(!campaign)return res.status(404).json({error:'Campaign not found.'});const update=kind==='impression'?{$inc:{impressions:1},$set:{lastImpressionAt:new Date(),lastPath:String(req.body.path||'').slice(0,200),userId:req.account?._id||null}}:kind==='dismiss'?{$inc:{dismissals:1},$set:{userId:req.account?._id||null}}:{$set:{convertedAt:new Date(),userId:req.account?._id||null}};await CampaignExposure.updateOne({visitorHash,campaignId:campaign._id},update,{upsert:true});res.json({ok:true});}catch(error){next(error);}};
r.post('/:id/impression',record('impression'));r.post('/:id/dismiss',record('dismiss'));r.post('/:id/convert',record('convert'));
export default r;
