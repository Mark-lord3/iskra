import { Router } from 'express';
import GalleryItem from '../models/GalleryItem.js';
import SiteSetting from '../models/SiteSetting.js';

const r = Router();

r.get('/gallery', async (_req,res,next)=>{
  try{
    const items = await GalleryItem.find({active:true}).sort({order:1,createdAt:-1}).lean();
    res.json(items.map(item=>({id:item._id,url:item.url,alt:item.alt,order:item.order})));
  }catch(e){ next(e); }
});

r.get('/site-status', async (_req,res,next)=>{
  try{
    const setting = await SiteSetting.findOne({key:'public-status'}).lean();
    res.json(setting?.value || {open:true,message:''});
  }catch(e){ next(e); }
});

r.get('/dating-app', async (_req,res,next)=>{
  try{
    const setting = await SiteSetting.findOne({key:'dating-app'}).lean();
    res.json(setting?.value || {
      enabled:false,
      competitionEnabled:false,
      message:'The ISKRA social room is currently closed.'
    });
  }catch(e){ next(e); }
});

export default r;
