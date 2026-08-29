alter table public.patient_files
  add column if not exists document_metadata jsonb not null default '{}'::jsonb;