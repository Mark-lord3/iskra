import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,verifyPassword} from '../src/lib/accountAuth.js';
import {EMAIL_TEMPLATES,emailTemplate} from '../src/services/emailCatalog.js';

test('account passwords use salted scrypt hashes',async()=>{
  const first=await hashPassword('A-secure-password-2026');
  const second=await hashPassword('A-secure-password-2026');
  assert.notEqual(first,second);
  assert.equal(await verifyPassword('A-secure-password-2026',first),true);
  assert.equal(await verifyPassword('wrong-password',first),false);
});

test('all 50 lifecycle emails exist in three complete locales',()=>{
  assert.equal(Object.keys(EMAIL_TEMPLATES).length,50);
  for(const [key,template] of Object.entries(EMAIL_TEMPLATES)){
    for(const locale of ['en','uk','ru']){
      assert.ok(template[locale].subject,`${key}/${locale} subject`);
      assert.ok(template[locale].headline,`${key}/${locale} headline`);
      assert.ok(template[locale].body.length>40,`${key}/${locale} body`);
      assert.deepEqual(emailTemplate(key,locale),template[locale]);
    }
  }
});
