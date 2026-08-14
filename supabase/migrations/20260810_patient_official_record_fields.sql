alter table public.patients
  add column if not exists patient_number text,
  add column if not exists first_name text,
  add column if not exists middle_name text,
  add column if not exists last_name text,
  add column if not exists suffix_name text,
  add column if not exists civil_status text,
  add column if not exists religion text,
  add column if not exists occupation text,
  add column if not exists guardian_name text,
  add column if not exists doctor_notes text;

create unique index if not exists patients_patient_number_unique
  on public.patients (patient_number)
  where patient_number is not null;

comment on column public.patients.patient_number is
  'Doc Kulot official patient number/code shown in the patient records sheet.';
comment on column public.patients.guardian_name is
  'Name of guardian for pediatric patients.';
comment on column public.patients.doctor_notes is
  'Doctor notes for the official patient records sheet, typically SOAP-formatted.';
