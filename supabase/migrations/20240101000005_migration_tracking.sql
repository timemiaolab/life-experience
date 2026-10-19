-- Migration tracking table
-- This table tracks which migrations have been applied to prevent duplicate execution
-- Compatible with Supabase CLI's schema versioning

-- Create schema first
CREATE SCHEMA IF NOT EXISTS supabase_migrations;

-- Create table in correct schema
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at 
  ON supabase_migrations.schema_migrations(applied_at DESC);
