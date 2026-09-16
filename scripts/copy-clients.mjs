import { cp, mkdir } from 'node:fs/promises';
await mkdir('dist/generated', { recursive: true });
for (const name of ['core', 'growth']) await cp(`generated/${name}`, `dist/generated/${name}`, { recursive: true });
