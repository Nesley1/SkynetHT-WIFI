CREATE POLICY api_rate_limits_deny_direct_access
ON private.api_rate_limits
FOR ALL
TO PUBLIC
USING (false)
WITH CHECK (false);
