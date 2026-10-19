-- Identity filter facets for the public graph (no wholesale contributor-row access).
CREATE OR REPLACE FUNCTION public.get_identity_facets()
RETURNS TABLE (id text, origin text, profession text, region text, age text, city text, node_ids text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.origin, c.profession, c.region, c.age, c.city, array_agg(n.id ORDER BY n.id)
  FROM public.contributors c JOIN public.nodes n ON n.contribution_id = c.id
  GROUP BY c.id, c.origin, c.profession, c.region, c.age, c.city;
$$;
REVOKE ALL ON FUNCTION public.get_identity_facets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_identity_facets() TO anon, authenticated;
