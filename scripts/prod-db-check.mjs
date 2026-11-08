// Production DB state check + logical backup of affected tables.
// READ-ONLY: performs no schema or data changes. Run: node scripts/prod-db-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Load .env.local without printing it
let env = {};
try {
  for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
} catch {
  console.error('No .env.local found');
  process.exit(1);
}
if (!env.DATABASE_URL) {
  console.error('DATABASE_URL missing from .env.local');
  process.exit(1);
}
process.env.DATABASE_URL = env.DATABASE_URL;

const { PrismaClient } = await import('@prisma/client');
const db = new PrismaClient();

const TABLES = ['themes', 'theme_versions', 'theme_assets', 'store_pages', 'blog_posts', 'store_settings', 'store_settings_versions'];

let stopBeforeIndex = false;

try {
  console.log('== 1. Table existence ==');
  for (const t of TABLES) {
    const r = await db.$queryRawUnsafe(`select to_regclass('public."${t}"') as t`);
    console.log(`${t}: ${r[0]?.t ? 'exists' : 'MISSING'}`);
  }

  console.log('\n== 2. Required columns (0002/0003) ==');
  const cols = await db.$queryRawUnsafe(
    `select table_name, column_name from information_schema.columns
     where table_schema='public' and table_name in ('store_pages','blog_posts')
       and column_name in ('seoTitle','seoDescription') order by table_name, column_name`,
  );
  if (cols.length === 0) console.log('none present (migrations needed)');
  else cols.forEach((c) => console.log(`${c.table_name}.${c.column_name}: PRESENT`));

  console.log('\n== 3. Index (0001) ==');
  const idx = await db.$queryRawUnsafe(`select indexname from pg_indexes where indexname='one_published_per_tenant'`);
  console.log(idx.length ? `one_published_per_tenant: PRESENT (${idx[0].indexname})` : 'not present (migration needed)');

  console.log('\n== 4. Duplicate-PUBLISHED precheck (0001 safety) ==');
  const dups = await db.$queryRawUnsafe(
    `select "tenantId", count(*)::int as c from themes where status='PUBLISHED' group by "tenantId" having count(*)>1`,
  );
  if (dups.length === 0) console.log('no duplicates — index creation is safe');
  else {
    console.log('DUPLICATES FOUND — do NOT create index until resolved:', JSON.stringify(dups));
    stopBeforeIndex = true;
  }

  console.log('\n== 5. Row counts ==');
  for (const t of TABLES) {
    try {
      const r = await db.$queryRawUnsafe(`select count(*)::int as n from "${t}"`);
      console.log(`${t}: ${r[0].n} rows`);
    } catch {
      console.log(`${t}: unreadable (missing table)`);
    }
  }

  console.log('\n== 6. Logical backup (JSON) ==');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(root, 'backups', `prod-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });
  for (const t of TABLES) {
    try {
      const rows = await db.$queryRawUnsafe(`select * from "${t}" limit 5000`);
      fs.writeFileSync(path.join(outDir, `${t}.json`), JSON.stringify(rows, (_k, v) => (typeof v === 'bigint' ? Number(v) : v), 2));
      console.log(`${t}: backed up ${rows.length} rows -> backups/prod-${stamp}/${t}.json`);
    } catch (e) {
      console.log(`${t}: backup skipped (${String(e.message).slice(0, 80)})`);
    }
  }

  console.log(`\nRESULT: ${stopBeforeIndex ? 'ATTENTION — duplicate published themes need manual resolution' : 'CHECKS OK — migrations 0001-0003 can be applied idempotently'}`);
} finally {
  await db.$disconnect();
}
