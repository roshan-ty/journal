import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
const result=await build({entryPoints:['mcp/server.mjs'],outfile:'dist-mcp/server.cjs',bundle:true,platform:'node',target:'node24',format:'cjs',metafile:true,legalComments:'eof'});
await fs.mkdir('.local',{recursive:true});
await fs.writeFile('.local/mcp-build-inputs.json',JSON.stringify(result.metafile,null,2));

// Keep redistribution notices without installing development dependency trees.
const packages=new Map();
async function collect(name,from=process.cwd()) {
  let dir=from,folder;
  while(true) {
    const candidate=path.join(dir,'node_modules',name);
    try {await fs.access(path.join(candidate,'package.json'));folder=candidate;break;}catch{}
    const parent=path.dirname(dir);if(parent===dir)return;dir=parent;
  }
  const metadata=JSON.parse(await fs.readFile(path.join(folder,'package.json'),'utf8'));
  const key=`${metadata.name}@${metadata.version}`;
  if(packages.has(key))return;
  const names=(await fs.readdir(folder)).filter(file=>/^(licen[sc]e|copying|notice)([.\-_]|$)/i.test(file));
  const licenses=[];
  for(const file of names)if((await fs.stat(path.join(folder,file))).isFile()) licenses.push(await fs.readFile(path.join(folder,file),'utf8'));
  packages.set(key,`${key}\nLicense: ${metadata.license || 'See upstream project'}\n${licenses.join('\n\n')}`);
  for(const dependency of Object.keys(metadata.dependencies || {})) await collect(dependency,folder);
}
for(const root of ['react','react-dom','lucide-react','recharts','papaparse','zod','@modelcontextprotocol/sdk'])await collect(root);
await fs.writeFile('build/DEPENDENCY_LICENSES.txt',[...packages.values()].join('\n\n'+'='.repeat(72)+'\n\n'));
console.log(`Bundled MCP: ${Object.keys(result.metafile.inputs).length} inputs; ${packages.size} license notices.`);
