import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const name = process.argv[2];
if (name !== 'growth') throw new Error('Usage: npm run context -- growth');
const destination = `context-export/${name}`;
await mkdir(destination, { recursive: true });
// An allowlist prevents secrets, database dumps and unrelated module code from leaking.
for (const path of ['shared', `modules/${name}`, 'packages', 'docs', 'README.md', 'package.json', 'tsconfig.json']) {
  await cp(path, `${destination}/${path}`, { recursive: true });
}
let commit = 'uncommitted';
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch {}
await writeFile(`${destination}/CONTEXT.json`, JSON.stringify({ module: name, commit, purpose: 'Frontend development reference; backend source of truth remains Core.' }, null, 2));
console.log(`Context exported to ${destination}; no environment files, signing keys or runtime data included.`);
