import fs from 'node:fs/promises';
import crypto from 'node:crypto';

// Input is downloaded directly from https://www.google.com/supported_domains.
// This maintenance script is never part of the installed application.
const input = await fs.readFile('.local/google-supported-domains.txt', 'utf8');
const domains = [...new Set(input.trim().split(/\s+/))].sort();
if (domains.length < 150 || domains.length > 250 ||
    domains.some(domain => !/^\.google\.(?:[a-z]{2,3}|(?:com|co)\.[a-z]{2})$/.test(domain)) ||
    !domains.includes('.google.com.pk') || !domains.includes('.google.com')) {
  throw Error('Unexpected Google domain list; review the official source before updating.');
}
const hosts = domains.map(domain => `accounts${domain}`);
await fs.writeFile('electron/google-auth-hosts.cjs',
  '// Exact account hosts derived from https://www.google.com/supported_domains\n' +
  '// Reviewed 2026-10-28. Do not replace with a suffix or wildcard match.\n' +
  'module.exports = Object.freeze(' + JSON.stringify(hosts, null, 2) + ');\n');
await fs.writeFile('research/google-auth-domains.json', JSON.stringify({
  source:'https://www.google.com/supported_domains', fetchedAt:new Date().toISOString(),
  sourceSha256:crypto.createHash('sha256').update(input).digest('hex'), accountHosts:hosts,
},null,2)+'\n');
console.log(`Generated ${hosts.length} exact Google account hostnames.`);
