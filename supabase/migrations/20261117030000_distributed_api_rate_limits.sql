CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  key_hash text PRIMARY KEY CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  request_count integer NOT NULL CHECK (request_count > 0),
  reset_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS api_rate_limits_reset_at_idx
  ON public.api_rate_limits (reset_at);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.api_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.api_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS TABLE (allowed boolean, retry_after integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_count integer;
  v_reset_at timestamptz;
BEGIN
  IF p_key_hash IS NULL OR p_key_hash !~ '^[a-f0-9]{64}$'
     OR p_limit IS NULL OR p_limit < 1 OR p_limit > 10000
     OR p_window_seconds IS NULL OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'INVALID_RATE_LIMIT_ARGUMENTS';
  END IF;

  INSERT INTO public.api_rate_limits AS limits (key_hash, request_count, reset_at)
  VALUES (p_key_hash, 1, v_now + pg_catalog.make_interval(secs => p_window_seconds))
  ON CONFLICT (key_hash) DO UPDATE
    SET request_count = CASE
          WHEN limits.reset_at <= v_now THEN 1
          ELSE limits.request_count + 1
        END,
        reset_at = CASE
          WHEN limits.reset_at <= v_now
            THEN v_now + pg_catalog.make_interval(secs => p_window_seconds)
          ELSE limits.reset_at
        END
  RETURNING request_count, reset_at INTO v_count, v_reset_at;

  IF pg_catalog.random() < 0.01 THEN
    DELETE FROM public.api_rate_limits
    WHERE reset_at < v_now - interval '1 day';
  END IF;

  RETURN QUERY
    SELECT v_count <= p_limit,
           GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_reset_at - v_now)))::integer);
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_api_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(text, integer, integer) TO service_role;
