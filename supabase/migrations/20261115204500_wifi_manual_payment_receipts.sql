-- Private storage for customer-submitted Wi-Fi payment receipts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wifi-payment-proofs',
  'wifi-payment-proofs',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Customers upload their own Wi-Fi payment receipts'
  ) then
    create policy "Customers upload their own Wi-Fi payment receipts"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'wifi-payment-proofs'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
end
$$;
