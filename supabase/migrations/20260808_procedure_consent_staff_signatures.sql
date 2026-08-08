-- Complete the digital consent form with the clinic witness and physician signatures.
alter table public.patient_procedure_consents
  add column if not exists witness_name text,
  add column if not exists witness_signature text,
  add column if not exists witness_signed_at timestamptz,
  add column if not exists physician_name text,
  add column if not exists physician_signature text,
  add column if not exists physician_signed_at timestamptz;
