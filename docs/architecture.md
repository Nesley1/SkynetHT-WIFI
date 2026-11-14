# Skynet Wi-Fi — Initial Architecture

## Services

| Component | Responsibility | Hosting |
|---|---|---|
| Web portal | Customer plans, login, account and admin UI | Vercel |
| API | Payment confirmation, voucher lifecycle, admin operations | Render |
| Database/Auth | Customers, plans, vouchers, payments, audit history | Supabase |
| HotSpot gateway | Captive portal enforcement and client sessions | MikroTik RouterOS |
| Outdoor AP | Broadcasts the public Wi-Fi network | TP-Link Omada EAP225-Outdoor |

## Network path

Starlink Ethernet → MikroTik hEX WAN → MikroTik LAN → EAP225-Outdoor PoE injector (LAN) → injector PoE port → outdoor access point.

The EAP should operate as an access point/bridge. MikroTik RouterOS owns HotSpot login and session control. Do not configure a second captive portal on the EAP.

## Customer lifecycle

1. A device associates with the public SSID.
2. RouterOS HotSpot redirects unauthenticated traffic to the portal.
3. Customer chooses a plan and receives payment instructions.
4. Backend verifies payment. During the first release, an administrator may confirm payment manually.
5. Backend provisions a unique HotSpot username/password and applies the plan's duration and speed profile.
6. Voucher validity begins at first successful login, not when payment is made.
7. Expired or blocked accounts cannot authenticate.

## Security requirements

- Never expose RouterOS API to the public internet.
- Backend-to-router communication must use a private, authenticated path (VPN/WireGuard or an equivalent secure tunnel).
- Keep RouterOS credentials, Supabase service-role keys, payment secrets, and signing secrets in backend environment variables only.
- Frontend may use only Supabase publishable/anon credentials and must rely on Row Level Security.
- Every privileged admin action must be authorized server-side and recorded in an audit log.
- Payment success must be verified server-side; never trust a browser redirect as proof of payment.
- Do not create a voucher or mark a payment paid until the backend has verified the payment.

## Initial roles

- Customer: view own profile, purchases, and active vouchers.
- Administrator: manage plans, payments, vouchers, users, router status, and reports.

## Initial release scope

- Customer registration/login
- Plan catalogue
- Manual payment review
- Voucher creation and display
- Voucher activation at first login
- Admin dashboard
- Voucher expiry and block controls
- Basic connection and sales history

Automated payment-provider integrations and advanced analytics can follow after the core hotspot flow is tested.
