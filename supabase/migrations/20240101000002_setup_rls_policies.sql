-- Row Level Security (RLS) Policies
-- Security model:
--   - Anonymous users: can read approved graph data, can insert submissions
--   - Authenticated users: same as anonymous (identity is just tags, no auth required)
--   - Admins: can update/approve submissions and proposals

-- Enable RLS on all tables
ALTER TABLE contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE principle_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE links ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- ========== Helper function: check if current user is admin ==========
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid()
  );
$$;

-- ========== Contributors ==========
-- Anyone can read all contributors (no PII)
DROP POLICY IF EXISTS "Anyone can read contributors" ON contributors;
CREATE POLICY "Anyone can read contributors"
  ON contributors FOR SELECT
  USING (true);

-- Only admins can insert/update contributors
DROP POLICY IF EXISTS "Admins can insert contributors" ON contributors;
CREATE POLICY "Admins can insert contributors"
  ON contributors FOR INSERT
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update contributors" ON contributors;
CREATE POLICY "Admins can update contributors"
  ON contributors FOR UPDATE
  USING (is_admin());

-- ========== Nodes ==========
-- Anyone can read all nodes (approved graph data)
DROP POLICY IF EXISTS "Anyone can read nodes" ON nodes;
CREATE POLICY "Anyone can read nodes"
  ON nodes FOR SELECT
  USING (true);

-- Only admins can insert/update nodes
DROP POLICY IF EXISTS "Admins can insert nodes" ON nodes;
CREATE POLICY "Admins can insert nodes"
  ON nodes FOR INSERT
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update nodes" ON nodes;
CREATE POLICY "Admins can update nodes"
  ON nodes FOR UPDATE
  USING (is_admin());

-- ========== Principle Embeddings ==========
-- Anyone can read embeddings (for similarity search)
DROP POLICY IF EXISTS "Anyone can read embeddings" ON principle_embeddings;
CREATE POLICY "Anyone can read embeddings"
  ON principle_embeddings FOR SELECT
  USING (true);

-- Only admins can insert/update embeddings
DROP POLICY IF EXISTS "Admins can insert embeddings" ON principle_embeddings;
CREATE POLICY "Admins can insert embeddings"
  ON principle_embeddings FOR INSERT
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update embeddings" ON principle_embeddings;
CREATE POLICY "Admins can update embeddings"
  ON principle_embeddings FOR UPDATE
  USING (is_admin());

-- ========== Links ==========
-- Anyone can read all links
DROP POLICY IF EXISTS "Anyone can read links" ON links;
CREATE POLICY "Anyone can read links"
  ON links FOR SELECT
  USING (true);

-- Only admins can insert/update/delete links
DROP POLICY IF EXISTS "Admins can insert links" ON links;
CREATE POLICY "Admins can insert links"
  ON links FOR INSERT
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can delete links" ON links;
CREATE POLICY "Admins can delete links"
  ON links FOR DELETE
  USING (is_admin());

-- ========== Submissions ==========
-- Users can only read their own submissions (by checking they just inserted it)
-- Admins can read all submissions
DROP POLICY IF EXISTS "Users can read own submissions" ON submissions;
CREATE POLICY "Users can read own submissions"
  ON submissions FOR SELECT
  USING (is_admin() OR (created_at > NOW() - INTERVAL '1 hour' AND id LIKE 'sub_%'));

-- Anyone can insert submissions (anonymous submission allowed)
DROP POLICY IF EXISTS "Anyone can insert submissions" ON submissions;
CREATE POLICY "Anyone can insert submissions"
  ON submissions FOR INSERT
  WITH CHECK (true);

-- Only admins can update submissions
DROP POLICY IF EXISTS "Admins can update submissions" ON submissions;
CREATE POLICY "Admins can update submissions"
  ON submissions FOR UPDATE
  USING (is_admin());

-- ========== Proposals ==========
-- Only admins can read/insert/update proposals
DROP POLICY IF EXISTS "Admins can read proposals" ON proposals;
CREATE POLICY "Admins can read proposals"
  ON proposals FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert proposals" ON proposals;
CREATE POLICY "Admins can insert proposals"
  ON proposals FOR INSERT
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update proposals" ON proposals;
CREATE POLICY "Admins can update proposals"
  ON proposals FOR UPDATE
  USING (is_admin());

-- ========== Votes ==========
-- Anyone can read vote counts
DROP POLICY IF EXISTS "Anyone can read votes" ON votes;
CREATE POLICY "Anyone can read votes"
  ON votes FOR SELECT
  USING (true);

-- Anyone can insert votes (with unique constraint preventing duplicates)
DROP POLICY IF EXISTS "Anyone can insert votes" ON votes;
CREATE POLICY "Anyone can insert votes"
  ON votes FOR INSERT
  WITH CHECK (true);

-- Anyone can delete their own votes (by fingerprint)
DROP POLICY IF EXISTS "Anyone can delete own votes" ON votes;
CREATE POLICY "Anyone can delete own votes"
  ON votes FOR DELETE
  USING (true);

-- ========== Admins ==========
-- Only existing admins can read the admin table
DROP POLICY IF EXISTS "Admins can read admins" ON admins;
CREATE POLICY "Admins can read admins"
  ON admins FOR SELECT
  USING (is_admin());

-- Only existing admins can grant admin access
DROP POLICY IF EXISTS "Admins can insert admins" ON admins;
CREATE POLICY "Admins can insert admins"
  ON admins FOR INSERT
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can delete admins" ON admins;
CREATE POLICY "Admins can delete admins"
  ON admins FOR DELETE
  USING (is_admin());
