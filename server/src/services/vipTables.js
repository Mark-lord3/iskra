import crypto from 'node:crypto';
import Order from '../models/Order.js';
import PromoCode from '../models/PromoCode.js';
import Ticket from '../models/Ticket.js';
import VipTableReservation from '../models/VipTableReservation.js';
import {VIP_TABLE_CAPACITY,vipTableDiscount} from '../../../shared/pricing.js';

const ACTIVE_ORDER_STATUSES=['pending','processing','paid'];

async function uniqueVipCode(){
  for(let attempt=0;attempt<8;attempt+=1){
    const code=`VIP-${crypto.randomBytes(7).toString('hex').toUpperCase()}`;
    if(!await PromoCode.exists({code}))return code;
  }
  throw new Error('Could not create a unique VIP admission code.');
}

async function ensureLegacyCode(order,slot){
  if(order.vipAdmissionCode)return order.vipAdmissionCode;
  const code=await uniqueVipCode();
  const off=vipTableDiscount(slot);
  await PromoCode.create({
    code,label:`VIP table admission, ${Math.round(off*100)}% off`,off,
    minQty:1,maxQty:4,stackable:false,active:true,public:false,singleUse:true,
    kind:'table',appliesTo:order.eventSlug
  });
  await Order.updateOne({_id:order._id,vipAdmissionCode:null},{$set:{
    vipAdmissionCode:code,vipDiscountPercent:Math.round(off*100),tableCount:1,vipTableSlots:[slot]
  }});
  return code;
}

/** Backfill paid/pending VIP orders created before table inventory existed. */
export async function syncLegacyVipTables(eventSlug){
  const now=new Date();
  await VipTableReservation.deleteMany({eventSlug,status:'pending',expiresAt:{$lte:now}});
  const orders=await Order.find({
    eventSlug,tierKey:'booth',status:{$in:ACTIVE_ORDER_STATUSES},
    $or:[{vipReservationToken:null},{vipReservationToken:{$exists:false}}]
  }).sort({createdAt:1,_id:1});
  const occupied=new Set((await VipTableReservation.find({eventSlug}).select('slot').lean()).map(row=>row.slot));
  for(const order of orders){
    const existing=await VipTableReservation.findOne({eventSlug,orderId:order._id}).lean();
    if(existing){
      occupied.add(existing.slot);
      if(!order.admissionQty){
        await Ticket.updateMany({orderId:order._id},{$set:{admissionValid:false}});
        await ensureLegacyCode(order,existing.slot);
      }
      continue;
    }
    const slot=Array.from({length:VIP_TABLE_CAPACITY},(_,index)=>index+1).find(value=>!occupied.has(value));
    if(!slot)break;
    try{
      await VipTableReservation.create({
        eventSlug,slot,orderId:order._id,token:`legacy-${order._id}-${slot}`,
        status:order.status==='paid'?'paid':'pending',
        expiresAt:order.status==='paid'?null:new Date(order.createdAt.getTime()+31*60_000)
      });
      occupied.add(slot);
      const legacy=!order.admissionQty;
      await Order.updateOne({_id:order._id},{$set:{tableCount:1,vipTableSlots:[slot],vipDiscountPercent:Math.round(vipTableDiscount(slot)*100)}});
      if(legacy){
        await Ticket.updateMany({orderId:order._id},{$set:{admissionValid:false}});
        await ensureLegacyCode(order,slot);
      }
    }catch(error){if(error?.code!==11000)throw error;}
  }
}

export async function vipAvailability(eventSlug){
  await syncLegacyVipTables(eventSlug);
  const rows=await VipTableReservation.find({eventSlug}).sort({slot:1}).lean();
  const occupied=new Set(rows.map(row=>row.slot));
  const nextSlot=Array.from({length:VIP_TABLE_CAPACITY},(_,index)=>index+1).find(slot=>!occupied.has(slot))||null;
  return {
    capacity:VIP_TABLE_CAPACITY,
    sold:rows.filter(row=>row.status==='paid').length,
    held:rows.filter(row=>row.status==='pending').length,
    remaining:VIP_TABLE_CAPACITY-rows.length,
    nextSlot,
    nextDiscountPercent:nextSlot?Math.round(vipTableDiscount(nextSlot)*100):0
  };
}

export async function allocateVipTable(eventSlug,{customOrderId=null,expiresAt=null}={}){
  await syncLegacyVipTables(eventSlug);
  for(let slot=1;slot<=VIP_TABLE_CAPACITY;slot+=1){
    const token=crypto.randomBytes(24).toString('base64url');
    try{
      const reservation=await VipTableReservation.create({
        eventSlug,slot,token,customOrderId,status:'pending',expiresAt:expiresAt||new Date(Date.now()+31*60_000)
      });
      return reservation;
    }catch(error){if(error?.code!==11000)throw error;}
  }
  throw Object.assign(new Error('VIP tables are sold out for this event.'),{status:409,code:'VIP_SOLD_OUT'});
}

export async function allocateVipTables(eventSlug,count,options={}){
  const reservations=[];
  try{
    for(let index=0;index<Math.max(0,Number(count)||0);index+=1)reservations.push(await allocateVipTable(eventSlug,options));
    return reservations;
  }catch(error){
    await VipTableReservation.deleteMany({token:{$in:reservations.map(row=>row.token)},status:'pending'});
    throw error;
  }
}

export const attachVipTable=async(token,orderId)=>VipTableReservation.updateOne({token,status:'pending'},{$set:{orderId}});
export const attachVipTables=async(tokens,orderId)=>VipTableReservation.updateMany({token:{$in:tokens},status:'pending'},{$set:{orderId}});
export const releaseVipTable=async({token=null,orderId=null}={})=>{
  const query=token?{token,status:'pending'}:orderId?{orderId,status:'pending'}:null;
  if(query)await VipTableReservation.deleteMany(query);
};
export const releaseCustomOrderVipTables=async customOrderId=>VipTableReservation.deleteMany({customOrderId,status:'pending',orderId:null});
export const releaseCustomCheckoutVipTables=async({orderId,customOrderId,expiresAt=null})=>{
  await Promise.all([
    VipTableReservation.deleteMany({orderId,status:'pending',customOrderId:null}),
    VipTableReservation.updateMany({orderId,status:'pending',customOrderId},{$set:{orderId:null,expiresAt}})
  ]);
};
export const markVipTablePaid=async orderId=>VipTableReservation.updateMany({orderId},{$set:{status:'paid',expiresAt:null}});
