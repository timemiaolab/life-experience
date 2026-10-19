-- Enable pgvector extension for similarity search
-- This migration is idempotent: safe to run multiple times

CREATE EXTENSION IF NOT EXISTS vector;

-- Verify the extension is enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  ) THEN
    RAISE EXCEPTION 'pgvector extension failed to install';
  END IF;
END $$;
