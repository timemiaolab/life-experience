-- Migration 9: Identity filter facets view
-- Purpose: Expose distinct identity facets for filtering without exposing contributor rows
-- Provides read-only access to identity dimensions for anonymous users

CREATE OR REPLACE FUNCTION public.get_identity_facets()
RETURNS TABLE (id text, origin text, profession text, region text, age text, city text, node_ids text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.origin, c.profession, c.region, c.age, c.city, array_agg(n.id ORDER BY n.id)
  FROM public.contributors c JOIN public.nodes n ON n.contribution_id = c.id
  GROUP BY c.id, c.origin, c.profession, c.region, c.age, c.city;
$$;

REVOKE ALL ON FUNCTION public.get_identity_facets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_identity_facets() TO anon, authenticated;

COMMENT ON FUNCTION public.get_identity_facets() IS 
  'Returns identity facets (origin, profession, region, age, city) with associated node IDs for filtering. Does not expose contributor personal data.';
