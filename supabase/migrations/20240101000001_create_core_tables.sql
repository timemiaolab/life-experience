-- Core tables for life-experience community
-- Vector dimension: 768 (compatible with Gemini text-embedding-004 with outputDimensionality=768)
-- Note: BGE-m3 uses 1024 dimensions; we chose 768 to support Gemini's free tier
-- All migrations are idempotent

-- ========== Contributors (identity tags only, no PII) ==========
CREATE TABLE IF NOT EXISTS contributors (
  id TEXT PRIMARY KEY,
  origin TEXT NOT NULL,
  profession TEXT NOT NULL,
  region TEXT NOT NULL,
  age TEXT NOT NULL,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  demo BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_contributors_created_at ON contributors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contributors_demo ON contributors(demo) WHERE NOT demo;

-- ========== Nodes (5-layer graph: area / scene / principle / idea / meaning) ==========
DO $$ BEGIN
  CREATE TYPE node_layer AS ENUM ('area', 'scene', 'principle', 'idea', 'meaning');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  layer node_layer NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  tag TEXT,
  keywords TEXT[],
  contribution_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  demo BOOLEAN NOT NULL DEFAULT FALSE,
  user_created BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_nodes_layer ON nodes(layer);
CREATE INDEX IF NOT EXISTS idx_nodes_contribution_id ON nodes(contribution_id) WHERE contribution_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nodes_created_at ON nodes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nodes_demo ON nodes(demo) WHERE NOT demo;

-- Principles with embedding vectors ==========
-- Embedding dimension: 768 (Gemini text-embedding-004 with outputDimensionality=768)
-- Note: BGE-m3 uses 1024-dim; we chose 768 for Gemini API compatibility
-- Store embeddings for similarity-based principle merging
CREATE TABLE IF NOT EXISTS principle_embeddings (
  principle_id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
  embedding vector(768) NOT NULL,
  embedding_model TEXT NOT NULL DEFAULT 'gemini-text-embedding-004',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HNSW index for fast similarity search (cosine distance)
-- m: max connections per layer (16 is good default)
-- ef_construction: build quality (64 is good default)
CREATE INDEX IF NOT EXISTS idx_principle_embeddings_vector 
  ON principle_embeddings 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ========== Links (typed edges between layers) ==========
CREATE TABLE IF NOT EXISTS links (
  id BIGSERIAL PRIMARY KEY,
  from_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  to_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(from_id, to_id)
);

CREATE INDEX IF NOT EXISTS idx_links_from_id ON links(from_id);
CREATE INDEX IF NOT EXISTS idx_links_to_id ON links(to_id);

-- ========== Submissions (raw stories awaiting AI processing) ==========
DO $$ BEGIN
  CREATE TYPE submission_status AS ENUM ('pending', 'processing', 'ai_done', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  contributor_id TEXT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  story TEXT NOT NULL,
  status submission_status NOT NULL DEFAULT 'pending',
  ai_output JSONB,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_contributor_id ON submissions(contributor_id);

-- ========== Proposals (AI merge proposals awaiting admin review) ==========
CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  proposal_data JSONB NOT NULL,
  approved BOOLEAN,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_submission_id ON proposals(submission_id);
CREATE INDEX IF NOT EXISTS idx_proposals_approved ON proposals(approved) WHERE approved IS NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals(created_at DESC);

-- ========== Votes ('有用' votes on principles) ==========
CREATE TABLE IF NOT EXISTS votes (
  id BIGSERIAL PRIMARY KEY,
  principle_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  voter_fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(principle_id, voter_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_votes_principle_id ON votes(principle_id);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes(created_at DESC);

-- Materialized vote counts for performance
CREATE MATERIALIZED VIEW IF NOT EXISTS vote_counts AS
  SELECT principle_id, COUNT(*) as count
  FROM votes
  GROUP BY principle_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vote_counts_principle_id ON vote_counts(principle_id);

-- Function to refresh vote counts (call after batch inserts/deletes)
CREATE OR REPLACE FUNCTION refresh_vote_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY vote_counts;
END;
$$;

-- ========== Admins (authorized user IDs) ==========
CREATE TABLE IF NOT EXISTS admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
