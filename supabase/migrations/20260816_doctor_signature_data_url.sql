-- Store the clinic doctor's saved signature image for prescription PDFs.
alter table public.system_settings
  add column if not exists doctor_signature_data_url text not null default '';
