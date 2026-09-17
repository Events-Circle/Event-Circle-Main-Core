import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
// Staging-only entry point: explicit database secret, persistent signing keys,
// additive committed migrations. Never generate new keys on every restart.
if (process.env.APP_STAGE !== 'staging') throw new Error('Staging entry point requires APP_STAGE=staging');
if (!process.env.JWT_PRIVATE_KEY_PEM || !process.env.JWT_PUBLIC_KEY_PEM || !process.env.DATABASE_URL)
  throw new Error('Missing staging secrets');
const dir = await mkdtemp(join(tmpdir(), 'circle-keys-'));
for (const [file, variable] of [
  ['private.pem', 'JWT_PRIVATE_KEY_PEM'],
  ['public.pem', 'JWT_PUBLIC_KEY_PEM'],
])
  await writeFile(join(dir, file), process.env[variable], { mode: 0o600 });
process.env.JWT_PRIVATE_KEY_PATH = join(dir, 'private.pem');
process.env.JWT_PUBLIC_KEY_PATH = join(dir, 'public.pem');
delete process.env.JWT_PRIVATE_KEY_PEM;
delete process.env.JWT_PUBLIC_KEY_PEM;
const migration = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
  cwd: '/app/backend',
  stdio: 'inherit',
  env: process.env,
});
if (migration.status !== 0) process.exit(migration.status ?? 1);
const child = spawn(process.execPath, ['dist/main.js'], {
  cwd: '/app/backend',
  stdio: 'inherit',
  env: process.env,
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 1));
