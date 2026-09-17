import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
const files = [];
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'generated', '.next', '.expo'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else if (/\.(ts|tsx)$/.test(p)) files.push(p);
  }
}
for (const root of ['backend/src', 'apps', 'packages']) await walk(root);
const failures = [];
for (const file of files) {
  const source = await readFile(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const owner = file.match(/^backend\/src\/modules\/([^/]+)/)?.[1];
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const spec = node.moduleSpecifier;
      if (spec && ts.isStringLiteral(spec)) {
        const name = spec.text;
        const target = name.startsWith('.') ? path.normalize(path.join(path.dirname(file), name)) : name;
        if (file.startsWith('backend/src/core/') && target.includes('/modules/'))
          failures.push(`${file}: Core imports module ${name}`);
        if (file.startsWith('backend/src/common/') && /\/(core|modules)\//.test(target))
          failures.push(`${file}: Common imports business code ${name}`);
        const other = target.match(/backend\/src\/modules\/([^/]+)/)?.[1];
        if (owner && other && owner !== other && !target.includes('/contracts/'))
          failures.push(`${file}: private cross-module import ${name}`);
        if (file.includes('/domain/') && /@nestjs|prisma|generated|infrastructure|api\//.test(target))
          failures.push(`${file}: framework or transport in domain ${name}`);
        if ((file.startsWith('apps/') || file.startsWith('packages/')) && /prisma|backend\//.test(target))
          failures.push(`${file}: frontend/shared package imports backend ${name}`);
        if (file.includes('/api/') && /database|repository|generated/.test(target))
          failures.push(`${file}: controller bypasses application layer ${name}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (owner && !file.includes('/infrastructure/') && /\.(presenceProfile|leadOpportunity)\./.test(source))
    failures.push(`${file}: database operation outside infrastructure`);
  if (owner === 'presence' && /\.leadOpportunity\./.test(source))
    failures.push(`${file}: Presence accesses Leads table`);
  if (owner === 'leads' && /\.presenceProfile\./.test(source))
    failures.push(`${file}: Leads accesses Presence table`);
  if (
    owner &&
    /\.(user|session|supplier|organization|membership|subscription|auditLog|outboxEvent)\.(create|find|update|delete|upsert|count)/.test(
      source,
    )
  )
    failures.push(`${file}: module directly accesses Core tables`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Architecture boundaries checked across ${files.length} source files.`);
