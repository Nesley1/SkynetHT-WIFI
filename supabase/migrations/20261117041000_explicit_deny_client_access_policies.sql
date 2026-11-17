-- These tables are backend-managed. Keep browser roles explicitly denied
-- even if table grants are accidentally added in a future change.
create policy deny_client_access on public.admin_audit_logs
  for all to anon, authenticated using (false) with check (false);
create policy deny_client_access on public.connection_sessions
  for all to anon, authenticated using (false) with check (false);
create policy deny_client_access on public.customer_discounts
  for all to anon, authenticated using (false) with check (false);
create policy deny_client_access on public.payments
  for all to anon, authenticated using (false) with check (false);
create policy deny_client_access on public.router_devices
  for all to anon, authenticated using (false) with check (false);
create policy deny_client_access on public.service_notices
  for all to anon, authenticated using (false) with check (false);
create policy deny_client_access on public.system_settings
  for all to anon, authenticated using (false) with check (false);
create policy deny_client_access on public.wifi_tickets
  for all to anon, authenticated using (false) with check (false);
