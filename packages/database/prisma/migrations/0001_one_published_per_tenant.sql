-- Migration 0001 — guarantee ONE PUBLISHED theme per tenant, even under races.
-- Apply manually on Neon AFTER a backup branch exists. This migration is additive.
--
-- 1) Create a backup branch of production in the Neon console (recommended).
-- 2) Apply this index. It is idempotent (IF NOT EXISTS).
-- 3) Verify:
--      SELECT "tenantId", count(*) FROM themes WHERE status = 'PUBLISHED'
--      GROUP BY "tenantId" HAVING count(*) > 1; (0 rows expected)
--
-- Rollback (if ever needed):
--    DROP INDEX IF EXISTS one_published_per_tenant;
--
-- psql:  psql "$DATABASE_URL" -f 0001_one_published_per_tenant.sql
-- Neon:  paste into the Neon SQL Editor.

CREATE UNIQUE INDEX IF NOT EXISTS one_published_per_tenant
  ON themes ("tenantId")
  WHERE status = 'PUBLISHED';
