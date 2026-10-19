-- Fix public_vote_counts view access for anon users
-- The view needs security_invoker=false so it runs with owner (postgres) permissions
-- This allows anon to read aggregate counts without direct access to vote_counts table

SET search_path = public, pg_catalog;

-- Change view to security_invoker=false (security definer mode)
-- This is intentional: the view only exposes aggregate counts (principle_id, count)
-- and does not expose any sensitive voter information. Running as owner (postgres)
-- allows anon to read the aggregate data without granting direct table access.
ALTER VIEW public_vote_counts SET (security_invoker = false);

-- Ensure grants are in place (idempotent)
GRANT SELECT ON public_vote_counts TO anon, authenticated;

-- Verify anon cannot read the underlying materialized view
-- (This should already be the case from migration 7, but making it explicit)
REVOKE SELECT ON vote_counts FROM PUBLIC, anon;
GRANT SELECT ON vote_counts TO authenticated;

COMMENT ON VIEW public_vote_counts IS 'Public read-only view of vote counts. Uses security_invoker=false to allow anon access to aggregate data without exposing the underlying materialized view. The security-definer-view advisor warning is intentional - the view only exposes aggregate counts, not sensitive voter information.';
