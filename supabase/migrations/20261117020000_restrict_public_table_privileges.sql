-- Keep customer-facing read access while denying direct table writes.
-- All privileged profile and Wi-Fi plan mutations are performed by the authenticated API
-- using the server-only service role after its own authorization checks.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.wifi_plans FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.profiles FROM anon, authenticated;
