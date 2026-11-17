-- Profiles are only needed by authenticated owners and the trusted API service role.
-- Remove the unused anonymous table-level read grant; RLS continues to restrict authenticated reads to the user's own row.
REVOKE SELECT ON TABLE public.profiles FROM anon;
