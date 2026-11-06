// Migration 0001 — structural verification of the checked-in SQL.
// Read-only. Verifies the file contains exactly the approved statement.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'packages', 'database', 'prisma', 'migrations', '0001_one_published_per_tenant.sql');
const raw = fs.readFileSync(FILE, 'utf8');
const sql = raw
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n')
  .trim();

const expected = `CREATE UNIQUE INDEX IF NOT EXISTS one_published_per_tenant
  ON themes ("tenantId")
  WHERE status = 'PUBLISHED';`;

const fails = [];
const ok = (name, cond) => {
  if (cond) console.log('  PASS', name);
  else {
    fails.push(name);
    console.error('  FAIL', name);
  }
};

console.log('Migration 0001 — structural checks');
ok('file exists and is non-empty', raw.length > 0);
ok('exactly one CREATE statement (comments ignored)', (sql.match(/CREATE/gi) || []).length === 1);
ok('statement matches approved SQL verbatim', sql === expected);
ok('unique index', /CREATE\s+UNIQUE\s+INDEX/i.test(sql));
ok('index name one_published_per_tenant', /one_published_per_tenant/.test(sql));
ok('targets themes table', /ON\s+themes\s*\(/i.test(sql));
ok('tenantId column quoted (camelCase)', /ON\s+themes\s*\(\s*"tenantId"\s*\)/i.test(sql));
ok('no unquoted tenant_id token anywhere in SQL', !/\btenant_id\b/.test(sql));
ok('partial predicate: status = \'PUBLISHED\'', /WHERE\s+status\s*=\s*'PUBLISHED'/i.test(sql));
ok('no destructive flags anywhere in file', !/--accept-data-loss|--force-reset|DROP\s+TABLE|DELETE\s+FROM|TRUNCATE/i.test(raw));

if (fails.length) {
  console.error(`\n${fails.length} check(s) FAILED`);
  process.exit(1);
}
console.log('\nMigration 0001 — all checks passed.');
