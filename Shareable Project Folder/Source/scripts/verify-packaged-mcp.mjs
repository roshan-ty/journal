import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {createRequire} from 'node:module';
import {emptyState} from '../shared/model.mjs';
const require=createRequire(import.meta.url);
const {openStore}=require('../electron/store.cjs');
const folder=await fs.mkdtemp(path.resolve('.local/mcp-release-'));
const store=openStore(folder);
const state=emptyState();
state.profile={id:'release-qa',name:'Release verification'};
state.accounts=[{id:'qa',number:'QA-RELEASE',name:'Isolated verification',source:'manual',currency:'USD',status:'active',initialBalance:10000}];
store.save(state);store.close();
const executable=path.resolve(process.argv[2] || 'release/win-unpacked/TradersYard Journal.exe');
const args=process.argv.slice(3);
if(!args.length)args.push(path.join(path.dirname(executable),'resources/mcp/server.cjs'));
const client=new Client({name:'release-verification',version:'1.0.0'});
const transport=new StdioClientTransport({command:executable,args,env:{...process.env,ELECTRON_RUN_AS_NODE:'1',TY_JOURNAL_DATA_DIR:folder,BBJ_JOURNAL_DATA_DIR:folder},stderr:'pipe'});
let errors='';
try {
  const connecting=client.connect(transport);
  transport.stderr?.on('data',data=>{errors+=data;});
  await connecting;
  const {tools}=await client.listTools();
  assert.equal(tools.length,8);
  const response=await client.callTool({name:'journal_list_accounts',arguments:{}});
  assert.equal(response.isError,undefined);
  const result=JSON.parse(response.content[0].text);
  assert.equal(result.accounts[0].number,'QA-RELEASE');
  console.log(JSON.stringify({executable,tools:tools.length,isolatedAccountRead:true,externalNodeRequired:false}));
} catch(error) {console.error(errors);throw error;}
finally {await client.close();}
