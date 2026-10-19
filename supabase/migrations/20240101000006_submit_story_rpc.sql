-- SECURITY DEFINER RPC for story submission
-- Allows anonymous users to submit stories without having direct INSERT access to contributors table

SET search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION submit_story(
  p_identity JSONB,
  p_story TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contributor_id TEXT;
  v_submission_id TEXT;
  v_origin TEXT;
  v_profession TEXT;
  v_region TEXT;
  v_age TEXT;
  v_city TEXT;
BEGIN
  -- Validate input
  IF p_story IS NULL OR LENGTH(TRIM(p_story)) < 30 THEN
    RAISE EXCEPTION 'Story must be at least 30 characters';
  END IF;
  
  IF LENGTH(p_story) > 2000 THEN
    RAISE EXCEPTION 'Story must be at most 2000 characters';
  END IF;
  
  -- Extract identity fields
  v_origin := p_identity->>'origin';
  v_profession := p_identity->>'profession';
  v_region := p_identity->>'region';
  v_age := p_identity->>'age';
  v_city := p_identity->>'city';
  
  -- Validate required identity fields
  IF v_origin IS NULL OR v_origin = '' THEN
    RAISE EXCEPTION 'Identity field "origin" is required';
  END IF;
  IF v_profession IS NULL OR v_profession = '' THEN
    RAISE EXCEPTION 'Identity field "profession" is required';
  END IF;
  IF v_region IS NULL OR v_region = '' THEN
    RAISE EXCEPTION 'Identity field "region" is required';
  END IF;
  IF v_age IS NULL OR v_age = '' THEN
    RAISE EXCEPTION 'Identity field "age" is required';
  END IF;
  
  -- Generate IDs
  v_contributor_id := 'c_' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 16);
  v_submission_id := 'sub_' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 16);
  
  -- Insert contributor
  INSERT INTO contributors (id, origin, profession, region, age, city, demo, created_at)
  VALUES (v_contributor_id, v_origin, v_profession, v_region, v_age, v_city, FALSE, NOW());
  
  -- Insert submission
  INSERT INTO submissions (id, contributor_id, story, status, created_at, updated_at)
  VALUES (v_submission_id, v_contributor_id, TRIM(p_story), 'pending', NOW(), NOW());
  
  -- Return submission ID
  RETURN v_submission_id;
END;
$$;

-- Grant execute to anon and authenticated users
GRANT EXECUTE ON FUNCTION submit_story(JSONB, TEXT) TO anon, authenticated;

-- Add comment
COMMENT ON FUNCTION submit_story IS 'Submit a story anonymously. Creates contributor and submission atomically.';
