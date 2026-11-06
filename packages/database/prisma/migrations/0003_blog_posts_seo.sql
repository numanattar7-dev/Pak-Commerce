-- Migration 0003 — additive SEO override columns for blog posts (M6).
-- Apply manually on a Neon branch AFTER a backup snapshot exists. Never run against production blindly.
-- Preserves every existing blog_posts row; only adds nullable columns.

ALTER TABLE "blog_posts"
  ADD COLUMN IF NOT EXISTS "seoTitle"       text,
  ADD COLUMN IF NOT EXISTS "seoDescription" text;

-- Rollback (if needed):
-- ALTER TABLE "blog_posts" DROP COLUMN IF EXISTS "seoTitle";
-- ALTER TABLE "blog_posts" DROP COLUMN IF EXISTS "seoDescription";
