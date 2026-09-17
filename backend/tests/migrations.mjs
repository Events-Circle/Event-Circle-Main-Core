import { readFile, readdir } from 'node:fs/promises';
export async function migrateDisposable(pg) {
  const base = new URL('../prisma/migrations/', import.meta.url);
  for (const entry of (await readdir(base, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    await pg.exec(await readFile(new URL(`${entry.name}/migration.sql`, base), 'utf8'));
  }
}
