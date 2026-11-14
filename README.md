# Skynet Wi-Fi

Public Wi-Fi hotspot and voucher management platform for Gonaïves, Haiti.

## Project structure

- `apps/web` — customer captive portal and administration interface.
- `apps/api` — secure backend API; communicates with Supabase and MikroTik RouterOS.
- `docs` — architecture, network setup, and deployment notes.

## Planned customer flow

1. Customer connects to the Skynet Wi-Fi access point.
2. MikroTik HotSpot redirects the customer to the portal.
3. Customer selects an access plan and follows the payment instructions.
4. Payment is confirmed by the backend (manual confirmation in the first release).
5. Backend creates a time-limited MikroTik HotSpot account.
6. Customer signs in and uses the Wi-Fi service.

## Initial access plans

- 1 hour
- 1 day
- 7 days
- 15 days
- 30 days

Plan prices and speed limits will be configurable by an administrator.

## Architecture

- Frontend: Vercel
- Backend: Render
- Database and authentication: Supabase
- Network gateway and HotSpot: MikroTik RouterOS
- Outdoor wireless access point: TP-Link Omada EAP225-Outdoor

The MikroTik API must only be accessed by the backend through a secured private connection. Router credentials and Supabase service credentials must never be placed in frontend code.

## Development status

The repository has been initialized. The next implementation stages are the web portal, backend API, Supabase schema and access policies, then secure MikroTik integration.

See [docs/architecture.md](docs/architecture.md) before configuring production services.
