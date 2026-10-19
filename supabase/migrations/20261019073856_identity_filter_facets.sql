-- Migration 9: Identity filter facets view
-- Purpose: Expose distinct identity facets for filtering without exposing contributor rows
-- Provides read-only access to identity dimensions for anonymous users

-- Create a security definer function that returns distinct identity facets
CREATE OR REPLACE FUNCTION public.get_identity_facets()
RETURNS TABLE (
  origin text,
  profession text,
  region text,
  age text,
  node_ids text[]
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    c.identity->>'origin' as origin,
    c.identity->>'profession' as profession,
    c.identity->>'region' as region,
    c.identity->>'age' as age,
    array_agg(n.id) as node_ids
  FROM contributions c
  JOIN nodes n ON n.contribution_id = c.id
  WHERE c.status = 'approved'
  GROUP BY c.identity->>'origin', c.identity->>'profession', c.identity->>'region', c.identity->>'age';
END;
$$;

-- Grant execute permission to anon users
GRANT EXECUTE ON FUNCTION public.get_identity_facets() TO anon;

COMMENT ON FUNCTION public.get_identity_facets() IS 
  'Returns distinct identity facets (origin, profession, region, age) with associated node IDs for filtering. Does not expose contributor personal data.';
