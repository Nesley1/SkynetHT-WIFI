-- Prevent the same manual MonCash/NatCash transaction reference from being
-- submitted more than once, including concurrent requests.
create unique index if not exists payments_manual_transaction_id_unique
on public.payments ((provider_payload ->> 'manual_transaction_id'))
where provider_payload ? 'manual_transaction_id'
  and nullif(btrim(provider_payload ->> 'manual_transaction_id'), '') is not null;
