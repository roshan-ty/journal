import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const [sourceArg, extractedArg, reportArg] = process.argv.slice(2);
if (!sourceArg || !extractedArg || !reportArg) throw Error('Specify runtime folder, extracted installer payload and report path.');
const source = path.resolve(sourceArg), extracted = path.resolve(extractedArg);
async function files(directory, prefix='') {
  const result=[];
  for (const entry of await fs.readdir(directory,{withFileTypes:true})) {
    if (entry.isSymbolicLink()) throw Error('Unexpected symbolic link');
    const relative=path.join(prefix,entry.name);
    if (entry.isDirectory()) result.push(...await files(path.join(directory,entry.name),relative));
    else result.push(relative);
  }
  return result.sort();
}
const expected=await files(source), actual=await files(extracted);
if (JSON.stringify(expected)!==JSON.stringify(actual)) throw Error('Installer and runtime file lists differ.');
const hash=async file=>crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
for (const file of expected) if (await hash(path.join(source,file))!==await hash(path.join(extracted,file))) throw Error('Installer payload mismatch: '+file);
const result={verifiedAt:new Date().toISOString(),source,extracted,matchingFiles:expected.length,allHashesMatch:true};
await fs.writeFile(reportArg,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
