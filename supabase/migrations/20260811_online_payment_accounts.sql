-- Store the clinic's manually configured online payment destinations.
-- Each JSON entry is managed from Settings and can include GCash/Maya/bank
-- account details plus an uploaded public QR code URL.
alter table public.system_settings
  add column if not exists online_payment_accounts jsonb not null default '[]'::jsonb;

update public.system_settings
set online_payment_accounts = '[]'::jsonb
where online_payment_accounts is null;
