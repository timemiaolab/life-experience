-- SECURITY DEFINER function to atomically approve a proposal
-- This function ensures that graph updates are atomic and consistent

CREATE OR REPLACE FUNCTION approve_proposal(
  p_proposal_id TEXT,
  p_admin_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_proposal RECORD;
  v_submission RECORD;
  v_result JSONB;
BEGIN
  -- Check admin privileges
  IF NOT EXISTS (SELECT 1 FROM admins WHERE user_id = p_admin_user_id) THEN
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
  SET approved = true, reviewed_by = p_admin_user_id, reviewed_at = NOW()
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

-- Function to reject a proposal
CREATE OR REPLACE FUNCTION reject_proposal(
  p_proposal_id TEXT,
  p_admin_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_proposal RECORD;
BEGIN
  -- Check admin privileges
  IF NOT EXISTS (SELECT 1 FROM admins WHERE user_id = p_admin_user_id) THEN
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
  SET approved = false, reviewed_by = p_admin_user_id, reviewed_at = NOW()
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
