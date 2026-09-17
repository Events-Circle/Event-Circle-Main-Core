import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
// High-confidence current-tree scan. Does not claim history or entropy coverage.
const patterns = {
  privateKey: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  githubToken: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/,
  githubFineGrained: /\bgithub_pat_[A-Za-z0-9_]{60,}\b/,
  awsAccessKey: /\bAKIA[0-9A-Z]{16}\b/,
  slackToken: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  stripeLiveKey: /\bsk_live_[A-Za-z0-9]{20,}\b/,
};
let failed = false;
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
for (const path of files) {
  const content = readFileSync(path, 'utf8');
  for (const [kind, pattern] of Object.entries(patterns))
    if (pattern.test(content)) {
      // Never print the matched credential.
      console.error(`${path}: possible ${kind}`);
      failed = true;
    }
}
if (failed) process.exitCode = 1;
else console.log(`Secret patterns checked in ${files.length} tracked files (current tree only).`);
