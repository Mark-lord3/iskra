import test from 'node:test';
import assert from 'node:assert/strict';
import {databaseUri} from '../src/config/database.js';
import {assertStripeConfiguration,stripeEnv} from '../src/config/stripe.js';
import {assertSecurityConfiguration} from '../src/config/security.js';

const KEYS=[
  'DEPLOY_ENV','MONGODB_URI','MONGODB_URI_live','MONGODB_URI_staging','STRIPE_MODE',
  'STRIPE_SECRET_KEY','STRIPE_PUBLISHABLE_KEY','STRIPE_WEBHOOK_SECRET',
  'STRIPE_SECRET_KEY_live','STRIPE_PUBLISHABLE_KEY_live','STRIPE_WEBHOOK_SECRET_live',
  'STRIPE_SECRET_KEY_test','STRIPE_PUBLISHABLE_KEY_test','STRIPE_WEBHOOK_SECRET_test',
  'NODE_ENV','CLIENT_ORIGIN','JWT_SECRET','SCANNER_SECRET','VISITOR_SIGNING_SECRET','SCANNER_PASSCODE','ADMIN_PASSWORD',
];

const withEnv=(values,run)=>{
  const previous=Object.fromEntries(KEYS.map(key=>[key,process.env[key]]));
  for(const key of KEYS) delete process.env[key];
  Object.assign(process.env,values);
  try{return run();}
  finally{
    for(const key of KEYS){
      if(previous[key] === undefined) delete process.env[key];
      else process.env[key]=previous[key];
    }
  }
};

test('production prefers live aliases over standard test keys',()=>withEnv({
  STRIPE_MODE:'live',
  STRIPE_SECRET_KEY:'sk_test_standard',
  STRIPE_PUBLISHABLE_KEY:'pk_test_standard',
  STRIPE_WEBHOOK_SECRET:'whsec_test',
  STRIPE_SECRET_KEY_live:'sk_live_selected',
  STRIPE_PUBLISHABLE_KEY_live:'pk_live_selected',
  STRIPE_WEBHOOK_SECRET_live:'whsec_live_selected',
},()=>{
  const config=assertStripeConfiguration();
  assert.equal(config.mode,'live');
  assert.equal(config.secretKey,'sk_live_selected');
  assert.equal(config.publishableKey,'pk_live_selected');
  assert.equal(config.webhookSecret,'whsec_live_selected');
}));

test('production refuses to silently fall back to test Stripe keys',()=>withEnv({
  STRIPE_MODE:'live',
  STRIPE_SECRET_KEY:'sk_test_wrong_mode',
  STRIPE_PUBLISHABLE_KEY:'pk_test_wrong_mode',
  STRIPE_WEBHOOK_SECRET:'whsec_test',
},()=>assert.throws(()=>assertStripeConfiguration(),/sk_live_/)));

test('staging selects test keys even when live aliases are present',()=>withEnv({
  STRIPE_MODE:'test',
  STRIPE_SECRET_KEY:'sk_test_selected',
  STRIPE_PUBLISHABLE_KEY:'pk_test_selected',
  STRIPE_WEBHOOK_SECRET:'whsec_test_selected',
  STRIPE_SECRET_KEY_live:'sk_live_ignored',
  STRIPE_PUBLISHABLE_KEY_live:'pk_live_ignored',
},()=>{
  const config=stripeEnv();
  assert.equal(config.secretKey,'sk_test_selected');
  assert.equal(config.publishableKey,'pk_test_selected');
}));

test('staging derives an isolated database while production retains the live database',()=>{
  const base='mongodb+srv://user:pass@example.mongodb.net/iskra_promo?retryWrites=true';
  withEnv({DEPLOY_ENV:'staging',MONGODB_URI:base},()=>{
    assert.match(databaseUri(),/\/iskra_promo_staging\?/);
  });
  withEnv({DEPLOY_ENV:'production',MONGODB_URI:base},()=>{
    assert.match(databaseUri(),/\/iskra_promo\?/);
    assert.doesNotMatch(databaseUri(),/_staging/);
  });
});

test('staging refuses an explicit production database URI',()=>withEnv({
  DEPLOY_ENV:'staging',
  MONGODB_URI_staging:'mongodb+srv://user:pass@example.mongodb.net/iskra_promo',
},()=>assert.throws(()=>databaseUri(),/isolated \*_staging database/)));

test('production refuses a staging database URI',()=>withEnv({
  DEPLOY_ENV:'production',
  MONGODB_URI_live:'mongodb+srv://user:pass@example.mongodb.net/iskra_promo_staging',
},()=>assert.throws(()=>databaseUri(),/cannot use the staging database/)));

test('production security configuration fails closed without dedicated secrets',()=>withEnv({
  NODE_ENV:'production',CLIENT_ORIGIN:'https://project-iskra.com',JWT_SECRET:'j'.repeat(64),
  SCANNER_SECRET:'s'.repeat(64),SCANNER_PASSCODE:'door-9274',ADMIN_PASSWORD:'admin-password-9274'
},()=>assert.throws(()=>assertSecurityConfiguration(),/VISITOR_SIGNING_SECRET/)));
