import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState, validateState, validateTrade} from '../shared/model.mjs';
import {newerRecord} from '../shared/records.mjs';

test('late save and read completions cannot replace a newer synced journal',()=>{
  const synced={revision:8,state:{accounts:['new']}};
  assert.equal(newerRecord(synced,{revision:7,state:{accounts:['old']}}),synced);
  assert.equal(newerRecord(synced,{revision:6,state:{accounts:[]}}),synced);
  const later={revision:9,state:{accounts:['newer']}};
  assert.equal(newerRecord(synced,later),later);
  assert.throws(()=>newerRecord(synced,{revision:NaN}),/revision/);
});
test('malformed account currencies fail before they can crash money formatting',()=>{
  const s=emptyState();s.accounts=[{id:'one',number:'A1',currency:'not-money'}];
  assert.throws(()=>validateState(s),/account/);
});
test('null optional collections migrate safely while malformed entries are rejected',()=>{
  const s=validateState({...emptyState(),notes:null,playbooks:null,habitLog:null});
  assert.deepEqual(s.notes,[]);assert.deepEqual(s.playbooks,[]);assert.deepEqual(s.habitLog,{});
  assert.throws(()=>validateState({...emptyState(),notes:[{id:'note',title:'Title',body:42}]}),/note/);
  assert.throws(()=>validateState({...emptyState(),playbooks:[{id:'book',name:'Setup',rules:null}]}),/strategy/);
  assert.throws(()=>validateState({...emptyState(),habits:[null]}),/habits/);
});
test('nonfinite optional execution amounts and malformed attachments cannot enter the journal',()=>{
  const account={id:'one',number:'A1',currency:'USD'};
  const trade={id:'t',accountId:'one',symbol:'ES',side:'long',status:'open',entryPrice:100,quantity:1,fees:0,openedAt:'2026-10-28T00:00:00Z'};
  for(const key of ['grossPnl','providerNetPnl','unrealizedPnl','exitPrice']) assert.throws(()=>validateTrade({...trade,[key]:Infinity},[account]),/Invalid/);
  assert.throws(()=>validateTrade({...trade,attachments:[{name:'remote',data:'https://invalid.test/picture'}]},[account]),/screenshots/);
  assert.equal(validateTrade({...trade,unrealizedPnl:-20},[account]).unrealizedPnl,-20);
});
