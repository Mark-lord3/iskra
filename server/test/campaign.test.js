import {test} from 'node:test';
import assert from 'node:assert/strict';
import {campaignEligible} from '../src/routes/campaigns.js';

test('anonymous acquisition campaigns stop after five total impressions',()=>{
  assert.equal(campaignEligible({exposure:null,frequencyCap:3}),true);
  assert.equal(campaignEligible({totalImpressions:4,frequencyCap:10}),true);
  assert.equal(campaignEligible({totalImpressions:5,frequencyCap:10}),false);
});

test('authenticated members are not subject to the anonymous acquisition cap',()=>{
  assert.equal(campaignEligible({authenticated:true,totalImpressions:20,frequencyCap:30}),true);
});

test('per-campaign frequency, dismissal, and conversion suppression are enforced',()=>{
  assert.equal(campaignEligible({exposure:{impressions:3},frequencyCap:3}),false);
  assert.equal(campaignEligible({exposure:{dismissals:2},frequencyCap:3}),false);
  assert.equal(campaignEligible({exposure:{convertedAt:new Date()},frequencyCap:3}),false);
});
