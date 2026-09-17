import { writeFile } from 'node:fs/promises';
import { createApp, specification } from './app.js';
const app = await createApp({
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 4000,
  issuer: 'http://localhost',
  audience: 'events-circle',
  keyId: 'docs',
  privateKeyPath: 'unused',
  publicKeyPath: 'unused',
  cors: [],
  trustProxy: [],
  edition: 'growth-os',
  enabled: ['presence', 'leads'],
});
await writeFile('openapi.json', JSON.stringify(specification(app), null, 2) + '\n');
await app.close();
