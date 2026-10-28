// Local-only UI verification harness. Never included in the Windows distribution.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {emptyState} from '../shared/model.mjs';
const state=emptyState();
state.profile={id:'qa',name:'UI verification'};
state.accounts=[{id:'usd',name:'US dollar account with a long descriptive name',number:'QA-USD-001',currency:'USD',source:'manual',status:'active',initialBalance:10000,rules:{profitTarget:1000}}, {id:'eur',name:'Euro account',number:'QA-EUR-002',currency:'EUR',source:'manual',status:'active',initialBalance:10000,rules:{}}];
state.trades=[100,-50,0,200,-75,90].map((pnl,i)=>({id:`qa-${i}`,accountId:i===5?'eur':'usd',symbol:i%2?'ES':'NQ',side:i%2?'short':'long',status:'closed',quantity:1,entryPrice:100,exitPrice:101,grossPnl:pnl,fees:2,initialRisk:50,openedAt:`2026-10-${String(20+i).padStart(2,'0')}T10:00:00Z`,closedAt:`2026-10-${String(20+i).padStart(2,'0')}T11:00:00Z`,notes:'',strategy:'Opening range',tags:['planned'],source:'manual'}));
state.playbooks=[{id:'qa-strategy',name:'Opening range',description:'A verification strategy',rules:['Define risk','Review the trade'],color:'#4250eb'}];
state.notes=[{id:'qa-note',title:'Review note',body:'UI verification note.',type:'Daily review',date:'2026-10-28',accountId:'all'}];
if(process.env.QA_SYNC_PREVIEW==='1') state.sync={...state.sync,connection:'connected',status:'syncing',message:'Loading trade history · 2 of 8',progress:{phase:'trades',completed:2,total:8}};
const adapter=`let record=${JSON.stringify({state,revision:1})};const listeners=new Set();window.journal={load:async()=>structuredClone(record),save:async(state,revision)=>{if(revision!==record.revision)throw Error('Journal changed. Retry.');record={state,revision:revision+1};for(const fn of listeners)fn();return structuredClone(record);},onChange:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};`;
const root=path.resolve('dist');
const port=Number(process.env.QA_PORT || 5176);
http.createServer(async(req,res)=>{
  try {
    const pathname=new URL(req.url,'http://127.0.0.1').pathname;
    let data,type;
    if(pathname==='/qa-adapter.js'){data=adapter;type='text/javascript';}
    else if(pathname==='/'){data=(await fs.readFile(path.join(root,'index.html'),'utf8')).replace('<div id="root">','<script src="/qa-adapter.js"></script><div id="root">');type='text/html';}
    else {const target=path.resolve(root,'.'+decodeURIComponent(pathname));if(!target.startsWith(root+path.sep))throw Error('Invalid path');data=await fs.readFile(target);type=({'.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2'})[path.extname(target)]||'application/octet-stream';}
    res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(data);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log('Isolated UI verification: http://127.0.0.1:'+port));
