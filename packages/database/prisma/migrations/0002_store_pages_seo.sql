-- Migration 0002 — additive SEO columns for store pages (M6).
-- Apply manually on a Neon branch AFTER a backup snapshot exists. Never run against production blindly.

ALTER TABLE "store_pages"
  ADD COLUMN IF NOT EXISTS "seoTitle"       text,
  ADD COLUMN IF NOT EXISTS "seoDescription" text;

-- Rollback (if needed):
-- ALTER TABLE "store_pages" DROP COLUMN IF EXISTS "seoTitle";
-- ALTER TABLE "store_pages" DROP COLUMN IF EXISTS "seoDescription";
