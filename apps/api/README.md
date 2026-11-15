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

## Payment launch guard

Checkout, the Tranzak webhook, payment reconciliation, and manual payment confirmation are disabled by default. Set `WIFI_PAYMENTS_ENABLED=true` only after the payment provider has been configured and verified, HotSpot voucher provisioning is implemented, and end-to-end tests confirm that customers receive the service they paid for. Until then, leave it unset or set it to `false`; payment endpoints return `503 WIFI_PAYMENTS_DISABLED`.

## Current implementation boundary

The API can prepare payment and ticket records, but it does not yet provision HotSpot users on the MikroTik. Router status is read-only. Do not enable paid checkout or promise customer internet access until private router connectivity, voucher creation/activation/expiry, provider verification, and end-to-end tests are complete. Never trust a browser redirect or client-submitted payment status.
