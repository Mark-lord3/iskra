import CustomOrder from '../models/CustomOrder.js';
import Event from '../models/Event.js';
import {customOrderQuote} from '../../../shared/pricing.js';
import {generateCustomOrderCode,hashCustomOrderCode,protectCustomOrderCode,revealCustomOrderCode} from '../lib/customOrderCode.js';
import {allocateVipTables,releaseCustomOrderVipTables} from './vipTables.js';

const EMAIL=/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
const text=(value,max=500)=>String(value||'').trim().slice(0,max);
const number=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));
const discount=value=>{
  const type=['percent','fixed'].includes(value?.type)?value.type:'none';
  return {type,value:number(value?.value,0,type==='percent'?100:100000)};
};

export function normalizeCustomOrderInput(body={}){
  const eventSlug=text(body.eventSlug,160);
  const customerEmail=text(body.customerEmail,200).toLowerCase();
  const admission={
    tierKey:['general','early'].includes(body.admission?.tierKey)?body.admission.tierKey:'general',
    qty:Math.floor(number(body.admission?.qty,0,20)),unitPrice:number(body.admission?.unitPrice,0,100000),
    discount:discount(body.admission?.discount)
  };
  const vip={
    qty:Math.floor(number(body.vip?.qty,0,4)),unitPrice:number(body.vip?.unitPrice,0,100000),
    discount:discount(body.vip?.discount),
    inclusions:(Array.isArray(body.vip?.inclusions)?body.vip.inclusions:String(body.vip?.inclusions||'').split('\n')).map(value=>text(value,160)).filter(Boolean).slice(0,20),
    reservationMode:body.vip?.reservationMode==='immediate'?'immediate':'checkout'
  };
  if(!eventSlug)throw Object.assign(new Error('Choose an event.'),{status:400});
  if(!admission.qty&&!vip.qty)throw Object.assign(new Error('Add admission tickets or at least one VIP table.'),{status:400});
  if(body.restrictEmail&&!EMAIL.test(customerEmail))throw Object.assign(new Error('A valid customer email is required for an email-restricted order.'),{status:400});
  return {
    eventSlug,customerName:text(body.customerName,100),customerEmail,restrictEmail:Boolean(body.restrictEmail),
    title:text(body.title,160)||'Private ISKRA order',description:text(body.description,1200),currency:'cad',
    admission,vip,allowPromoStacking:Boolean(body.allowPromoStacking),internalNotes:text(body.internalNotes,3000),
    expiresAt:body.expiresAt?new Date(body.expiresAt):null,maxRedemptions:Math.floor(number(body.maxRedemptions,1,100))||1
  };
}

export async function createCustomOrder(body,adminId){
  const payload=normalizeCustomOrderInput(body);
  if(payload.expiresAt&&Number.isNaN(payload.expiresAt.getTime()))throw Object.assign(new Error('Enter a valid expiry date.'),{status:400});
  if(!await Event.exists({slug:payload.eventSlug}))throw Object.assign(new Error('Event not found.'),{status:404});
  let raw;
  let secured;
  for(let attempt=0;attempt<8;attempt+=1){
    raw=generateCustomOrderCode();secured=protectCustomOrderCode(raw);
    if(!await CustomOrder.exists({codeHash:secured.codeHash}))break;
  }
  const order=await CustomOrder.create({...payload,...secured,createdBy:adminId,updatedBy:adminId,audit:[{action:'created',actorId:adminId}]});
  try{
    if(order.vip.qty&&order.vip.reservationMode==='immediate'){
      const holds=await allocateVipTables(order.eventSlug,order.vip.qty,{customOrderId:order._id,expiresAt:order.expiresAt});
      order.vipReservationTokens=holds.map(row=>row.token);
      order.audit.push({action:'vip_reserved',actorId:adminId,details:{slots:holds.map(row=>row.slot)}});
      await order.save();
    }
  }catch(error){await CustomOrder.deleteOne({_id:order._id});throw error;}
  return {order,code:raw};
}

export function customOrderStatus(order,now=new Date()){
  if(order.status==='active'&&order.expiresAt&&new Date(order.expiresAt)<=now)return 'expired';
  return order.status;
}

export async function expireCustomOrderIfNeeded(order){
  if(customOrderStatus(order)==='expired'&&order.status==='active'){
    order.status='expired';order.audit.push({action:'expired'});await order.save();
    await releaseCustomOrderVipTables(order._id);
  }
  return order;
}

export function adminCustomOrder(order,{includeCode=true}={}){
  const pricing=customOrderQuote({admission:order.admission,vip:order.vip});
  return {id:order._id,eventSlug:order.eventSlug,customerName:order.customerName,customerEmail:order.customerEmail,restrictEmail:order.restrictEmail,
    title:order.title,description:order.description,currency:order.currency,admission:order.admission,vip:order.vip,
    allowPromoStacking:order.allowPromoStacking,internalNotes:order.internalNotes,status:customOrderStatus(order),expiresAt:order.expiresAt,
    maxRedemptions:order.maxRedemptions,redemptionCount:order.redemptionCount,reservedOrderId:order.reservedOrderId,usedAt:order.usedAt,
    createdAt:order.createdAt,updatedAt:order.updatedAt,audit:order.audit,pricing,
    code:includeCode?revealCustomOrderCode(order):undefined,codeSuffix:order.codeSuffix};
}

export function publicCustomOrder(order,event,pricing){
  return {id:order._id,eventSlug:order.eventSlug,eventTitle:event.title,eventDate:event.date,title:order.title,description:order.description,
    currency:order.currency,customerName:order.customerName,customerEmail:order.restrictEmail?order.customerEmail:'',requiresEmail:order.restrictEmail,admission:order.admission,vip:order.vip,
    allowPromoStacking:order.allowPromoStacking,expiresAt:order.expiresAt,remainingRedemptions:Math.max(0,order.maxRedemptions-order.redemptionCount),pricing};
}

export async function findCustomOrderByCode(code){
  const order=await CustomOrder.findOne({codeHash:hashCustomOrderCode(code)});
  if(order)await expireCustomOrderIfNeeded(order);
  return order;
}
