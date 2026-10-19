-- Bootstrap: Mark existing migrations as applied
-- Run this ONCE on the live database to mark the 5 initial migrations as already applied
-- This prevents them from being re-executed by the new tracking system

-- Create tracking schema and table if not exists (idempotent)
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mark the 5 existing migrations as applied
-- Use ON CONFLICT to make this idempotent
INSERT INTO supabase_migrations.schema_migrations (version, applied_at) VALUES
  ('20240101000000_enable_pgvector', NOW()),
  ('20240101000001_create_core_tables', NOW()),
  ('20240101000002_setup_rls_policies', NOW()),
  ('20240101000003_approval_functions', NOW()),
  ('20240101000004_seed_demo_data', NOW()),
  ('20240101000005_migration_tracking', NOW())
ON CONFLICT (version) DO NOTHING;

-- Verify
SELECT version, applied_at 
FROM supabase_migrations.schema_migrations 
ORDER BY version;
