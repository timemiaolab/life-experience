-- Migration tracking table
-- This table tracks which migrations have been applied to prevent duplicate execution
-- Compatible with Supabase CLI's schema versioning

CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS supabase_migrations;

-- Recreate table in correct schema if it was created in wrong place
DROP TABLE IF EXISTS public.schema_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at 
  ON supabase_migrations.schema_migrations(applied_at DESC);
