import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import {isTradersYardConnected} from '../shared/connection.mjs';
import {collectTradersYard} from '../shared/tradersyard.mjs';
import {emptyState, validateState, mergeSnapshot} from '../shared/model.mjs';
const require = createRequire(import.meta.url);
const {TradersYardProvider} = require('../electron/provider.cjs');
const {showMaximized} = require('../electron/window.cjs');
const flush = () => new Promise(resolve => setImmediate(resolve));
const expired = () => Object.assign(Error('Session expired'), {code:'TY_AUTH_REQUIRED'});

function fixture(t) {
  const windows = [], connections = [], issues = [];
  let ready = 0;
  class WebContents extends EventEmitter {
    url = 'about:blank';
    getURL() { return this.url; }
    isDestroyed() { return false; }
    setWindowOpenHandler(fn) { this.openHandler = fn; }
    reload() { this.reloaded = true; }
    navigationHistory = {canGoBack:()=>true,goBack:()=>{this.wentBack=true;}};
    navigate(url) { this.url = url; this.emit('did-navigate'); this.emit('did-navigate-in-page'); this.emit('did-finish-load'); }
  }
  class Window extends EventEmitter {
    webContents = new WebContents(); destroyed = false;
    constructor(options) { super(); this.options = options; windows.push(this); }
    isDestroyed() { return this.destroyed; }
    close() { if (!this.destroyed) { this.destroyed = true; this.emit('closed'); } }
    show() { this.shown = true; }
    focus() { this.focused = true; }
    setMenu(menu) { this.menu = menu; }
    async loadURL(url) { this.webContents.url = url; }
  }
  const authSession = {setPermissionRequestHandler(){},setPermissionCheckHandler(){},async clearStorageData(){},async clearCache(){}};
  const provider = new TradersYardProvider({
    electron:{BrowserWindow:Window,session:{fromPartition:()=>authSession},net:{},Menu:{buildFromTemplate:template=>template}},
    onReady:()=>{ready++;},onConnectionChange:(value,error)=>connections.push({value,code:error?.code}),
    onAuthIssue:message=>issues.push(message),
  });
  provider.requestJson = async () => { throw expired(); };
  t.after(()=>provider.disconnect());
  return {provider, windows, Window, connections, issues, ready:()=>ready};
}

test('connection UI ignores stale lastSync and distinguishes transport errors from expired sign-in', () => {
  for (const status of ['connected','partial','syncing']) assert.equal(isTradersYardConnected({status}),true);
  assert.equal(isTradersYardConnected({status:'error',connection:'connected'}),true);
  for (const status of ['connected','partial','error','disconnected'])
    assert.equal(isTradersYardConnected({status,connection:'disconnected',lastSync:'2026-10-20'}),false);
  assert.equal(isTradersYardConnected({status:'disconnected',lastSync:'2026-10-20'}),false);
  assert.equal(isTradersYardConnected(),false);
});

test('valid saved session connects without opening a website window', async t => {
  const f=fixture(t);
  f.provider.requestJson=async()=>({data:[]});
  const result=await f.provider.connect(); await flush();
  assert.equal(result.connected,true); assert.equal(f.windows.length,0); assert.equal(f.ready(),1);
  assert.equal(f.connections.at(-1).value,true);
});

test('verified sign-in closes parent and OAuth windows and starts one sync despite duplicate navigation events', async t => {
  const f=fixture(t);
  await f.provider.connect();
  const parent=f.windows[0], child=new f.Window({});
  parent.webContents.emit('did-create-window',child);
  f.provider.nextRequestAt=0;
  f.provider.requestJson=async()=>({data:[]});
  child.webContents.navigate('https://tradersyard.com/app/dashboard');
  parent.webContents.navigate('https://tradersyard.com/app/');
  await flush(); await flush();
  assert.equal(parent.isDestroyed(),true); assert.equal(child.isDestroyed(),true);
  assert.equal(f.provider.window,null); assert.equal(f.ready(),1);
});

test('dashboard URL alone does not close sign-in; a failed check can recover on the next navigation', async t => {
  const f=fixture(t); await f.provider.connect(); const win=f.windows[0];
  f.provider.nextRequestAt=0;
  win.webContents.navigate('https://tradersyard.com/app/'); await flush();
  assert.equal(win.isDestroyed(),false); assert.equal(f.ready(),0);
  f.provider.nextRequestAt=0; f.provider.requestJson=async()=>({data:[]});
  win.webContents.navigate('https://tradersyard.com/app/challenges'); await flush();
  assert.equal(win.isDestroyed(),true); assert.equal(f.ready(),1);
});

test('duplicate connect requests share one login and auth navigation rejects lookalike domains', async t => {
  const f=fixture(t);
  await Promise.all([f.provider.connect(),f.provider.connect()]);
  await f.provider.connect(); assert.equal(f.windows.length,1);
  const win=f.windows[0];
  assert.equal(win.focused,true);
  assert.equal(win.webContents.openHandler({url:'https://tradersyard.com.evil.test/app/'}).action,'deny');
  let blocked=false;
  win.webContents.emit('will-redirect',{preventDefault(){blocked=true;}},'http://tradersyard.com/app/');
  assert.equal(blocked,true);
});

test('disconnect during verification cannot reauthenticate from a late response', async t => {
  const f=fixture(t); let finish;
  f.provider.requestJson=()=>new Promise(resolve=>{finish=resolve;});
  const attempt=f.provider.verifySession(); await flush();
  await f.provider.disconnect(); finish({data:[]});
  await assert.rejects(attempt,{code:'TY_DISCONNECTED'});
  assert.equal(f.provider.authenticated,false); assert.equal(f.ready(),0);
});

test('Google account checks and blank OAuth popups retain sandboxing and navigation restrictions', async t => {
  const f=fixture(t); await f.provider.connect(); const parent=f.windows[0];
  for (const url of ['https://accounts.google.com/v3/signin/challenge/pwd','https://accounts.youtube.com/accounts/CheckConnection']) {
    let blocked=false;
    parent.webContents.emit('will-redirect',{url,preventDefault(){blocked=true;}});
    assert.equal(blocked,false);
    assert.equal(parent.webContents.openHandler({url}).action,'allow');
  }
  const popup=parent.webContents.openHandler({url:'about:blank'});
  assert.equal(popup.action,'allow');
  assert.equal(popup.overrideBrowserWindowOptions.webPreferences.sandbox,true);
  assert.equal(popup.overrideBrowserWindowOptions.webPreferences.nodeIntegration,false);
  const child=new f.Window(popup.overrideBrowserWindowOptions);
  parent.webContents.emit('did-create-window',child);
  for (const url of ['https://accounts.youtube.com.evil.test/?code=SECRET','file:///secret','https://accounts.google.com:444/','https://user:SECRET@accounts.google.com/']) {
    let blocked=false;
    child.webContents.emit('will-navigate',{url,preventDefault(){blocked=true;}});
    assert.equal(blocked,true);
  }
  assert.equal(f.issues.some(issue=>issue.includes('SECRET')),false);
});

test('failed or unresponsive authentication pages have native recovery and no sensitive diagnostics', async t => {
  const f=fixture(t); await f.provider.connect(); const win=f.windows[0];
  const menu=win.menu[0].submenu;
  menu.find(item=>item.label==='Go back').click(); assert.equal(win.webContents.wentBack,true);
  menu.find(item=>item.label==='Reload page').click(); assert.equal(win.webContents.reloaded,true);
  win.webContents.emit('did-fail-load',{},-3,'cancelled','https://accounts.google.com/?code=SECRET',true);
  win.webContents.emit('did-fail-load',{},-105,'private description','https://accounts.google.com/?code=SECRET',false);
  assert.equal(f.issues.length,0);
  win.webContents.emit('did-fail-load',{},-105,'private description','https://accounts.google.com/?code=SECRET',true);
  win.webContents.emit('did-fail-load',{},-105,'private description','https://accounts.google.com/?code=SECRET',true);
  assert.equal(f.issues.length,1);
  win.emit('unresponsive');
  win.webContents.emit('render-process-gone',{},{});
  assert.equal(f.issues.length,3);
  assert.equal(f.issues.some(issue=>/SECRET|private description/.test(issue)),false);
  const child=new f.Window({}); win.webContents.emit('did-create-window',child);
  win.webContents.url='https://accounts.google.com/';
  menu.find(item=>item.label==='Restart TradersYard sign-in').click();
  assert.equal(win.webContents.getURL(),'https://tradersyard.com/auth/login');
  assert.equal(child.isDestroyed(),true);
  assert.equal(win.isDestroyed(),false);
  menu.find(item=>item.label==='Close sign-in').click();
  assert.equal(win.isDestroyed(),true);
});

test('Google regional redirects do not block password submission or authenticate the journal early', async t => {
  const f=fixture(t); await f.provider.connect(); const win=f.windows[0];
  for (const host of ['accounts.google.com.pk','accounts.google.co.in','accounts.google.co.uk','accounts.google.de']) {
    const url=`https://${host}/accounts/CheckConnection`;
    let blocked=false;
    win.webContents.emit('will-redirect',{url,isMainFrame:false,preventDefault(){blocked=true;}});
    assert.equal(blocked,false,host);
    assert.equal(win.webContents.openHandler({url}).action,'allow');
    win.webContents.navigate(`https://${host}/app/`);
  }
  await flush();
  assert.equal(f.issues.length,0);
  assert.equal(f.provider.authenticated,false);
  assert.equal(f.ready(),0);
  f.provider.nextRequestAt=0;
  f.provider.requestJson=async()=>({data:[]});
  win.webContents.navigate('https://tradersyard.com/app/dashboard');
  await flush(); await flush();
  assert.equal(win.isDestroyed(),true);
  assert.equal(f.ready(),1);
});

test('regional Google allowlist rejects lookalikes, unrelated subdomains and unsafe URLs', async t => {
  const f=fixture(t); await f.provider.connect(); const wc=f.windows[0].webContents;
  for (const url of [
    'https://accounts.google.com.pk.attacker.example/',
    'https://fake.accounts.google.com.pk/',
    'https://accounts.google.invalid/',
    'https://accounts.google.com.pkk/',
    'https://accounts.google.com.pk@attacker.example/',
    'https://accounts.google.com.pk:444/',
    'http://accounts.google.com.pk/',
    'https://user:SECRET@accounts.google.com.pk/',
  ]) {
    let blocked=false;
    wc.emit('will-redirect',{url,preventDefault(){blocked=true;}});
    assert.equal(blocked,true,url);
    assert.equal(wc.openHandler({url}).action,'deny');
  }
  assert.equal(f.issues.some(message=>message.includes('SECRET')),false);
});

test('closing a cancelled login also closes its OAuth child without beginning a sync', async t => {
  const f=fixture(t); await f.provider.connect(); const win=f.windows[0],child=new f.Window({});
  win.webContents.emit('did-create-window',child); win.close();
  assert.equal(child.isDestroyed(),true); assert.equal(f.ready(),0); assert.equal(f.provider.window,null);
});

test('session expiry during account collection is fatal, rather than successful partial sync', async () => {
  const getJson=async route=>route.includes('?')?{data:[{tc_id:'acct',status:'active'}]}:Promise.reject(expired());
  await assert.rejects(collectTradersYard(getJson),{code:'TY_AUTH_REQUIRED'});
});

test('opening an app restores a minimized window, maximizes before showing, and ignores closed windows', () => {
  const events=[];
  const win={isDestroyed:()=>false,isMinimized:()=>true,restore:()=>events.push('restore'),maximize:()=>events.push('maximize'),show:()=>events.push('show'),focus:()=>events.push('focus')};
  showMaximized(win); assert.deepEqual(events,['restore','maximize','show','focus']);
  showMaximized(null); showMaximized({...win,isDestroyed:()=>true}); assert.equal(events.length,4);
});

test('malformed connection values in backups are rejected and legacy missing sync is migrated', () => {
  assert.throws(()=>validateState({...emptyState(),sync:'connected'}),/connection state/);
  assert.throws(()=>validateState({...emptyState(),sync:{status:'connected',connection:'maybe'}}),/connection state/);
  const old=emptyState(); delete old.sync;
  assert.equal(validateState(old).sync.status,'disconnected');
});

test('manual CSV imports and legacy manual journals never masquerade as authenticated sessions', () => {
  const state=emptyState(); state.accounts=[{id:'manual',number:'1',currency:'USD',source:'manual'}];
  const imported=mergeSnapshot(state,{accounts:[],trades:[]}).state;
  assert.equal(isTradersYardConnected(imported.sync),false);
  delete imported.sync.connection;
  assert.equal(isTradersYardConnected(validateState(imported).sync),false);
  imported.accounts[0].source='tradersyard';
  assert.equal(isTradersYardConnected(validateState(imported).sync),true);
});
