import test from 'node:test';
import assert from 'node:assert/strict';
import {assertSecurityConfiguration,originAllowed} from '../src/config/security.js';
import {createInvite,readInvite} from '../src/lib/scannerAuth.js';
import {safeImageUrl,safePublicHref} from '../src/lib/publicContent.js';

const KEYS=['NODE_ENV','CLIENT_ORIGIN','JWT_SECRET','SCANNER_SECRET','VISITOR_SIGNING_SECRET','SCANNER_PASSCODE','ADMIN_PASSWORD'];
const withEnv=(values,run)=>{
  const previous=Object.fromEntries(KEYS.map(key=>[key,process.env[key]]));
  KEYS.forEach(key=>delete process.env[key]);Object.assign(process.env,values);
  try{return run();}finally{for(const key of KEYS){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}}
};

const strongProduction={
  NODE_ENV:'production',CLIENT_ORIGIN:'https://project-iskra.com',
  JWT_SECRET:'j'.repeat(64),SCANNER_SECRET:'s'.repeat(64),VISITOR_SIGNING_SECRET:'v'.repeat(64),
  SCANNER_PASSCODE:'door-9274',ADMIN_PASSWORD:'admin-password-9274'
};

test('production refuses predictable or missing signing secrets',()=>withEnv({
  ...strongProduction,VISITOR_SIGNING_SECRET:''
},()=>assert.throws(()=>assertSecurityConfiguration(),/VISITOR_SIGNING_SECRET/)));

test('production accepts explicit strong security configuration',()=>withEnv(strongProduction,()=>{
  assert.doesNotThrow(()=>assertSecurityConfiguration());
  assert.equal(originAllowed('https://project-iskra.com'),true);
  assert.equal(originAllowed('https://evil.example'),false);
  assert.equal(originAllowed(),false);
}));

test('production rejects wildcard, insecure, and short-passcode configuration',()=>{
  withEnv({...strongProduction,CLIENT_ORIGIN:'http://project-iskra.com'},()=>assert.throws(()=>assertSecurityConfiguration(),/explicit HTTPS/));
  withEnv({...strongProduction,CLIENT_ORIGIN:'https://*.project-iskra.com'},()=>assert.throws(()=>assertSecurityConfiguration(),/without wildcards/));
  withEnv({...strongProduction,SCANNER_PASSCODE:'123456'},()=>assert.throws(()=>assertSecurityConfiguration(),/at least 8/));
  withEnv({...strongProduction,CLIENT_ORIGIN:'https://user:pass@project-iskra.com'},()=>assert.throws(()=>assertSecurityConfiguration(),/explicit HTTPS/));
  withEnv({...strongProduction,CLIENT_ORIGIN:'https://project-iskra.com/path'},()=>assert.throws(()=>assertSecurityConfiguration(),/explicit HTTPS/));
});

test('scanner invites carry an unpredictable one-use identifier',()=>withEnv({SCANNER_SECRET:'s'.repeat(64)},()=>{
  const first=readInvite(createInvite({label:'Front door'}));
  const second=readInvite(createInvite({label:'Front door'}));
  assert.ok(first.jti);assert.ok(second.jti);assert.notEqual(first.jti,second.jti);
}));

test('public content helpers reject script, credential, and insecure URLs',()=>{
  assert.equal(safePublicHref('javascript:alert(1)','/safe'),'/safe');
  assert.equal(safePublicHref('//evil.example','/safe'),'/safe');
  assert.equal(safePublicHref('https://user:pass@example.com','/safe'),'/safe');
  assert.equal(safePublicHref('/schedule','/safe'),'/schedule');
  assert.equal(safeImageUrl('http://example.com/a.jpg'), '');
  assert.equal(safeImageUrl('/gallery/a.jpg'),'/gallery/a.jpg');
});
