import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import * as model from '../shared/model.mjs';
import {collectTradersYard,normalizeAccount} from '../shared/tradersyard.mjs';
import {reuseJournalData} from '../shared/records.mjs';
const require=createRequire(import.meta.url);
const {openStore}=require('../electron/store.cjs');
const {createSynchronizer}=require('../electron/sync.cjs');
const {TradersYardProvider}=require('../electron/provider.cjs');
const raw={tc_id:'ACCOUNT-1',status:'failed',state:{closed_profit_loss:20},current_level:{}};
const row={id:1,instrument:'ES',originType:'long',volume:1,lotSize:1,price:6000,avgExitPrice:6001,createdDateTime:'2026-10-01T10:00:00Z',lastChangeDateTime:'2026-10-01T11:00:00Z',closedProfitLoss:20};
const failure=code=>Object.assign(Error(code),{code});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function database(t,state=model.emptyState()) {
  fs.mkdirSync(path.resolve('.local'),{recursive:true});
  const dir=fs.mkdtempSync(path.resolve('.local/sync-regression-'));
  const store=openStore(dir);store.save({...state,sync:{...state.sync,connection:'connected'}});
  t.after(()=>store.close());return store;
}
function get(route) {
  if(route.includes('?'))return {data:[raw],meta:{last_page:1}};
  if(route.endsWith('/closed'))return {data:[row]};
  if(route.endsWith('/open'))return {data:[]};
  return {data:{}};
}
test('first-login accounts and trades become durable before slow rules complete',async t=>{
  const store=database(t);let release,entered=false;
  const provider={getJson:async route=>{
    if(route.endsWith('/stats')){entered=true;await new Promise(resolve=>{release=resolve;});}
    return get(route);
  }};
  const snapshots=[];
  const sync=createSynchronizer({store,provider,model,collect:collectTradersYard,notify:()=>snapshots.push(store.read())});
  const pending=sync();assert.equal(sync(),pending,'concurrent requests share one job');
  while(!entered)await flush();
  assert.equal(snapshots[1].state.accounts.length,1);
  assert.equal(snapshots[1].state.trades.length,0);
  assert.equal(store.read().state.trades.length,1);
  assert.equal(store.read().state.sync.status,'syncing');
  const during=store.read();during.state.trades[0].notes='Edited while syncing';store.save(during.state,during.revision);
  release();await pending;
  assert.equal(store.read().state.trades[0].notes,'Edited while syncing');
  assert.equal(store.read().state.sync.status,'connected');
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM snapshots').get().n,2,'one pre-sync checkpoint plus the user edit, not one snapshot per progress tick');
});
test('later authentication failure preserves downloaded trades and permits the next job',async t=>{
  const store=database(t);let fail=true;
  const provider={getJson:async route=>{if(fail&&route.endsWith('/open'))throw failure('TY_AUTH_REQUIRED');return get(route);}};
  const sync=createSynchronizer({store,provider,model,collect:collectTradersYard,notify:()=>{}});
  await assert.rejects(sync(),{code:'TY_AUTH_REQUIRED'});
  assert.equal(store.read().state.accounts.length,1);assert.equal(store.read().state.trades.length,1);
  assert.equal(store.read().state.sync.status,'error');
  fail=false;await sync();assert.equal(store.read().state.trades.length,1);
});
test('archived completed history is cached; missing history resumes without refetching static rules',async()=>{
  let old={...normalizeAccount(raw,{}, {},{}),historySyncedAt:'done',openSyncedAt:'done',detailsSyncedAt:'done'};
  const routes=[];const read=async route=>{routes.push(route);return get(route);};
  await collectTradersYard(read,{existing:[old],refreshHistory:false});assert.equal(routes.length,1);
  routes.length=0;delete old.historySyncedAt;
  const result=await collectTradersYard(read,{existing:[old],refreshHistory:false});
  assert.equal(result.trades.length,1);assert.equal(routes.length,2);assert.ok(routes[1].endsWith('/closed'));
});
test('targeted retry on an archived account fixes the failed endpoint and clears stale issue messaging',async t=>{
  const state=model.emptyState();state.accounts=[{...normalizeAccount(raw,{}, {},{}),historySyncedAt:'done',openSyncedAt:'done',detailsSyncedAt:'done'}];
  state.sync.lastFullCoverage={issues:['ACCOUNT-1 closed: unavailable'],accounts:1};
  const store=database(t,state),routes=[];
  const sync=createSynchronizer({store,provider:{getJson:async route=>{routes.push(route);return get(route);}},model,collect:collectTradersYard,notify:()=>{}});
  await sync(false,true);
  assert.equal(routes.length,2);assert.ok(routes[1].endsWith('/closed'));
  assert.equal(store.read().state.sync.lastFullCoverage.issues.length,0);
  assert.equal(store.read().state.sync.status,'connected');assert.equal(store.read().state.trades.length,1);
});
test('invalid or timed-out open snapshots never delete locally saved open positions',async()=>{
  const snapshots=[];
  await collectTradersYard(async route=>{if(route.endsWith('/open'))throw failure('TY_TIMEOUT');return get(route);},{onSnapshot:async snapshot=>snapshots.push(snapshot)});
  assert.ok(snapshots.some(s=>s.trades.length===1));
  assert.equal(snapshots.flatMap(s=>s.completedOpenAccountIds||[]).length,0);
});
test('rate limiting stops collection promptly after persisting already completed endpoints',async t=>{
  const store=database(t),routes=[];
  const sync=createSynchronizer({store,provider:{getJson:async route=>{routes.push(route);if(route.endsWith('/open'))throw failure('TY_RATE_LIMIT');return get(route);}},model,collect:collectTradersYard,notify:()=>{}});
  await assert.rejects(sync(),{code:'TY_RATE_LIMIT'});
  assert.equal(routes.length,3);assert.equal(store.read().state.trades.length,1);
});
test('cancelled sync cannot restore connection or save a late endpoint result',async t=>{
  const store=database(t);let epoch=0;
  const sync=createSynchronizer({store,provider:{getJson:async route=>{
    if(route.endsWith('/closed')){epoch++;const current=store.read();store.save({...current.state,sync:{connection:'disconnected',status:'disconnected'}},current.revision);}
    return get(route);
  }},model,collect:collectTradersYard,notify:()=>{},getEpoch:()=>epoch});
  await sync();assert.equal(store.read().state.sync.connection,'disconnected');assert.equal(store.read().state.trades.length,0);
});
test('transient network failures retry once, while rate-limit and auth errors do not',async()=>{
  const provider=new TradersYardProvider({electron:{session:{fromPartition:()=>({setPermissionRequestHandler(){},setPermissionCheckHandler(){}})}}});
  let attempts=0;
  provider.requestJson=async()=>{provider.nextRequestAt=0;if(++attempts===1)throw failure('TY_TIMEOUT');return {data:[]};};
  await provider.getJson('/api/v4.0/challenges?page=1');assert.equal(attempts,2);
  for(const code of ['TY_RATE_LIMIT','TY_AUTH_REQUIRED']){
    attempts=0;provider.nextRequestAt=0;provider.requestJson=async()=>{attempts++;throw failure(code);};
    await assert.rejects(provider.getJson('/api/v4.0/challenges?page=1'),{code});assert.equal(attempts,1);
  }
});
test('sync-only IPC updates reuse analytical collections without hiding changed trade data',()=>{
  const current={revision:1,state:{accounts:[{id:'1'}],trades:[{id:'t',pnl:10}],settings:{theme:'dark'},sync:{status:'syncing'}}};
  const incoming=structuredClone(current);incoming.revision=2;incoming.state.sync.status='connected';
  const shared=reuseJournalData(current,incoming);
  assert.equal(shared.state.trades,current.state.trades);assert.equal(shared.state.accounts,current.state.accounts);
  assert.equal(shared.state.sync.status,'connected');
  incoming.state.trades[0].pnl=20;
  const changed=reuseJournalData(current,incoming);assert.notEqual(changed.state.trades,current.state.trades);assert.equal(changed.state.trades[0].pnl,20);
});
