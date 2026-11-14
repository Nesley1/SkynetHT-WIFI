# Skynet Wi-Fi API

This directory contains the server-side API deployed on Render.

## Security boundary

- Only this API may communicate with the MikroTik router.
- Never put Supabase secret/service-role keys or MikroTik credentials in the frontend.
- Do not expose RouterOS API ports (8728/8729) or RouterOS REST (80/443) directly to the public internet.
- RouterOS REST must be reachable by the API only through a private, authenticated network path (for example, a site-to-site VPN or an outbound-only private agent).
- Use a dedicated RouterOS account with the minimum required permissions. Do not use the router's full administrator account.

## MikroTik connectivity status (read-only)

The API now has an admin-only endpoint:

`GET /api/admin/router/status`

It reads only `/rest/system/resource` and returns basic router model/version/uptime and resource information. It does not create, modify, enable, disable, or delete HotSpot users.

Render environment variables (server-side only):

- `MIKROTIK_REST_URL`: HTTPS base URL reachable through the private network path, e.g. `https://10.50.0.1`
- `MIKROTIK_API_USER`: dedicated RouterOS username
- `MIKROTIK_API_PASSWORD`: password for that dedicated user

The endpoint remains disabled until all three variables are present. The URL must use HTTPS and must not embed credentials. The API has a five-second request timeout and does not return credentials or raw RouterOS error bodies.

## Existing environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (Render only; never frontend)
- `ALLOWED_ORIGIN` (defaults to the production Vercel site)
- `PORT` (defaults to 10000 on Render)

## Current implementation boundary

Payment records can be created as pending, but payment confirmation and ticket issuance must remain manual/disabled until provider verification and router connectivity are implemented and tested. Do not activate real customer access based only on a browser redirect or client-submitted status.
