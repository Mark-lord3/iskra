import test from 'node:test';
import assert from 'node:assert/strict';
import {customOrderQuote} from '../../shared/pricing.js';
import {generateCustomOrderCode,hashCustomOrderCode,normalizeCustomOrderCode,protectCustomOrderCode,revealCustomOrderCode} from '../src/lib/customOrderCode.js';

test('custom package independently discounts admission and VIP',()=>{
  const result=customOrderQuote({
    admission:{qty:4,unitPrice:25,discount:{type:'percent',value:20}},
    vip:{qty:1,unitPrice:140,discount:{type:'fixed',value:40}}
  });
  assert.equal(result.subtotal,240);
  assert.equal(result.admissionDiscount,20);
  assert.equal(result.vipDiscount,40);
  assert.equal(result.total,180);
});

test('ordinary promo stacking affects admission after the custom discount, never VIP',()=>{
  const result=customOrderQuote({
    admission:{qty:4,unitPrice:25,discount:{type:'percent',value:20}},
    vip:{qty:1,unitPrice:140,discount:{type:'none',value:0}},
    promo:{code:'STACK',off:.25,minQty:4,maxQty:20,status:'live'},allowPromoStacking:true
  });
  assert.equal(result.promoDiscount,20);
  assert.equal(result.lines.find(line=>line.type==='admission').total,60);
  assert.equal(result.lines.find(line=>line.type==='vip').total,140);
  assert.equal(result.total,200);
});

test('VIP-only and admission-only custom packages are valid calculations',()=>{
  assert.equal(customOrderQuote({vip:{qty:2,unitPrice:100}}).total,200);
  assert.equal(customOrderQuote({admission:{qty:3,unitPrice:15}}).total,45);
});

test('custom discounts can never make a line or order negative',()=>{
  const result=customOrderQuote({admission:{qty:2,unitPrice:10,discountType:'fixed',discountValue:999},vip:{qty:1,unitPrice:50,discountType:'percent',discountValue:999}});
  assert.equal(result.total,0);assert.equal(result.saved,result.subtotal);
});

test('custom order codes normalize, hash, encrypt, and decrypt without storing plaintext',()=>{
  const raw=generateCustomOrderCode();const secured=protectCustomOrderCode(raw);
  assert.match(raw,/^ISKRA-[A-Z0-9_-]{16,}$/);
  assert.equal(hashCustomOrderCode(` ${raw.toLowerCase()} `),secured.codeHash);
  assert.equal(revealCustomOrderCode(secured),normalizeCustomOrderCode(raw));
  assert.equal(secured.codeCiphertext.includes(raw),false);
});
