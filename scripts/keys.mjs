import { generateKeyPairSync } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('.secrets', { recursive: true, mode: 0o700 });
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
// Never overwrite keys accidentally; running this twice fails safely.
await writeFile('.secrets/private.pem', privateKey.export({ type: 'pkcs8', format: 'pem' }), {
  flag: 'wx',
  mode: 0o600,
});
await writeFile('.secrets/public.pem', publicKey.export({ type: 'spki', format: 'pem' }), {
  flag: 'wx',
  mode: 0o644,
});
console.log('Created local development signing keys. Keep the private key out of Git.');
