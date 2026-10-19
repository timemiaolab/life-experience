-- Security fixes and improvements
-- Addresses:
-- (a) Remove insecure submissions SELECT policy
-- (b) Fix approve/reject functions to use auth.uid() instead of parameter
-- (c) Restrict votes DELETE policy to voter
-- (d) Revoke unnecessary function execution rights
-- (e) Set search_path on all functions
-- (f) Secure vote_counts view
-- (g) Document vector extension schema decision

SET search_path = public, pg_catalog;

-- ========== (a) Fix submissions RLS policies ==========
-- Remove the insecure policy that exposed submissions for an hour
DROP POLICY IF EXISTS "Users can read own submissions" ON submissions;

-- Anon users should not read submissions at all
-- The submit_story RPC returns the ID directly
DROP POLICY IF EXISTS "Admins can read submissions" ON submissions;
CREATE POLICY "Admins can read submissions"
  ON submissions FOR SELECT
  USING (EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid()));

-- ========== (b) Fix approve/reject functions to use auth.uid() ==========
DROP FUNCTION IF EXISTS approve_proposal(TEXT, UUID);
CREATE OR REPLACE FUNCTION approve_proposal(p_proposal_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal RECORD;
  v_submission RECORD;
  v_result JSONB;
  v_admin_user_id UUID;
BEGIN
  -- Check admin privileges using auth.uid()
  v_admin_user_id := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM admins WHERE user_id = v_admin_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: user is not an admin';
  END IF;

  -- Get proposal
  SELECT * INTO v_proposal FROM proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposal not found: %', p_proposal_id;
  END IF;

  IF v_proposal.approved IS NOT NULL THEN
    RAISE EXCEPTION 'Proposal already reviewed';
  END IF;

  -- Get submission
  SELECT * INTO v_submission FROM submissions WHERE id = v_proposal.submission_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found: %', v_proposal.submission_id;
  END IF;

  -- Start transaction: insert contributor, nodes, links atomically
  -- The proposal_data JSONB should contain:
  --   { "contributor": {...}, "nodes": [...], "links": [[from, to], ...] }
  
  -- Insert contributor if not exists
  INSERT INTO contributors (id, origin, profession, region, age, city, demo)
  SELECT 
    (v_proposal.proposal_data->'contributor'->>'id'),
    (v_proposal.proposal_data->'contributor'->>'origin'),
    (v_proposal.proposal_data->'contributor'->>'profession'),
    (v_proposal.proposal_data->'contributor'->>'region'),
    (v_proposal.proposal_data->'contributor'->>'age'),
    (v_proposal.proposal_data->'contributor'->>'city'),
    COALESCE((v_proposal.proposal_data->'contributor'->>'demo')::boolean, false)
  ON CONFLICT (id) DO NOTHING;

  -- Insert nodes from proposal
  INSERT INTO nodes (id, layer, title, description, tag, keywords, contribution_id, demo, user_created)
  SELECT 
    (node->>'id')::TEXT,
    (node->>'layer')::node_layer,
    (node->>'title')::TEXT,
    (node->>'description')::TEXT,
    (node->>'tag')::TEXT,
    CASE 
      WHEN node->'keywords' IS NOT NULL 
      THEN ARRAY(SELECT jsonb_array_elements_text(node->'keywords'))
      ELSE NULL 
    END,
    (node->>'contribution_id')::TEXT,
    COALESCE((node->>'demo')::boolean, false),
    COALESCE((node->>'user_created')::boolean, true)
  FROM jsonb_array_elements(v_proposal.proposal_data->'nodes') AS node
  ON CONFLICT (id) DO NOTHING;

  -- Insert links from proposal
  INSERT INTO links (from_id, to_id)
  SELECT 
    (link->>0)::TEXT,
    (link->>1)::TEXT
  FROM jsonb_array_elements(v_proposal.proposal_data->'links') AS link
  ON CONFLICT (from_id, to_id) DO NOTHING;

  -- Mark proposal as approved
  UPDATE proposals 
  SET approved = true, reviewed_by = v_admin_user_id, reviewed_at = NOW()
  WHERE id = p_proposal_id;

  -- Mark submission as approved
  UPDATE submissions
  SET status = 'approved', updated_at = NOW()
  WHERE id = v_proposal.submission_id;

  -- Return success result
  v_result := jsonb_build_object(
    'success', true,
    'proposal_id', p_proposal_id,
    'submission_id', v_proposal.submission_id
  );

  RETURN v_result;
END;
$$;

DROP FUNCTION IF EXISTS reject_proposal(TEXT, UUID, TEXT);
CREATE OR REPLACE FUNCTION reject_proposal(
  p_proposal_id TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal RECORD;
  v_admin_user_id UUID;
BEGIN
  -- Check admin privileges using auth.uid()
  v_admin_user_id := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM admins WHERE user_id = v_admin_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: user is not an admin';
  END IF;

  -- Get proposal
  SELECT * INTO v_proposal FROM proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposal not found: %', p_proposal_id;
  END IF;

  IF v_proposal.approved IS NOT NULL THEN
    RAISE EXCEPTION 'Proposal already reviewed';
  END IF;

  -- Mark proposal as rejected
  UPDATE proposals 
  SET approved = false, reviewed_by = v_admin_user_id, reviewed_at = NOW()
  WHERE id = p_proposal_id;

  -- Mark submission as rejected
  UPDATE submissions
  SET status = 'rejected', rejection_reason = p_reason, updated_at = NOW()
  WHERE id = v_proposal.submission_id;

  RETURN jsonb_build_object(
    'success', true,
    'proposal_id', p_proposal_id,
    'submission_id', v_proposal.submission_id,
    'reason', p_reason
  );
END;
$$;

-- Update is_admin to set search_path
DROP FUNCTION IF EXISTS is_admin();
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid()
  );
$$;

-- ========== (c) Restrict votes DELETE policy ==========
DROP POLICY IF EXISTS "Anyone can delete own votes" ON votes;
CREATE POLICY "Users can delete own votes"
  ON votes FOR DELETE
  USING (voter_fingerprint = current_setting('request.headers', true)::json->>'x-fingerprint');

-- Note: For better security, the frontend should send a consistent fingerprint header
-- For now, we allow deletion based on fingerprint matching

-- ========== (d) Revoke unnecessary function execution rights ==========
-- Revoke from public (anon/authenticated inherit from public)
REVOKE EXECUTE ON FUNCTION refresh_vote_counts() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION approve_proposal(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION reject_proposal(TEXT, TEXT) FROM PUBLIC;

-- Grant only to authenticated users (admins check is inside the function)
GRANT EXECUTE ON FUNCTION approve_proposal(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_proposal(TEXT, TEXT) TO authenticated;

-- Keep is_admin usable by policies (SECURITY DEFINER handles access)
GRANT EXECUTE ON FUNCTION is_admin() TO anon, authenticated;

-- refresh_vote_counts should only be called by admins or background jobs
-- Grant to authenticated, gated by is_admin check
GRANT EXECUTE ON FUNCTION refresh_vote_counts() TO authenticated;

-- Update refresh_vote_counts to check admin
DROP FUNCTION IF EXISTS refresh_vote_counts();
CREATE OR REPLACE FUNCTION refresh_vote_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can refresh vote counts
  IF NOT EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: only admins can refresh vote counts';
  END IF;
  
  REFRESH MATERIALIZED VIEW CONCURRENTLY vote_counts;
END;
$$;

-- ========== (f) Secure vote_counts materialized view access ==========
-- Create a safe view that wraps the materialized view
CREATE OR REPLACE VIEW public_vote_counts AS
  SELECT principle_id, count
  FROM vote_counts;

-- Grant SELECT on the view to anon
GRANT SELECT ON public_vote_counts TO anon, authenticated;

-- Note: The materialized view vote_counts itself should have restricted access
-- Only the public_vote_counts view is exposed to anon users
REVOKE SELECT ON vote_counts FROM PUBLIC;
GRANT SELECT ON vote_counts TO authenticated;

-- ========== Comments and documentation ==========
COMMENT ON FUNCTION approve_proposal IS 'Approve a proposal and atomically update the graph. Admin only (checks auth.uid()).';
COMMENT ON FUNCTION reject_proposal IS 'Reject a proposal with a reason. Admin only (checks auth.uid()).';
COMMENT ON FUNCTION refresh_vote_counts IS 'Refresh the materialized vote counts view. Admin only.';
COMMENT ON VIEW public_vote_counts IS 'Public read-only view of vote counts.';

-- ========== (g) Vector extension schema ==========
-- Decision: Keep pgvector in public schema
-- Reason: Moving to extensions schema would require:
--   1. ALTER TYPE vector SET SCHEMA extensions; (may break existing columns)
--   2. Updating all vector(768) column definitions
--   3. Risk of breaking existing data and queries
-- The pgvector extension is designed to work in the public schema and
-- PostgreSQL's search_path handles it correctly. Moving it provides minimal
-- security benefit while adding migration complexity.
-- 
-- If stronger isolation is needed in the future, consider:
--   - Creating new tables in a separate schema
--   - Using explicit schema qualification (extensions.vector)
--   - But DO NOT move the extension after columns are already created

COMMENT ON EXTENSION vector IS 'pgvector extension kept in public schema for compatibility with existing vector(768) columns. See migration 20240101000007 for rationale.';
