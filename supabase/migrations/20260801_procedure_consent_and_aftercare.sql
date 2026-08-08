-- Store procedure consent captured during booking/reservation.
-- The form is tied to the payment reservation first, then linked to the
-- confirmed appointment after checkout/webhook conversion.

create table if not exists public.patient_procedure_consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  reservation_id uuid references public.online_booking_reservations(id) on delete set null,
  procedure_name text not null,
  patient_name text not null,
  patient_signature text not null,
  consent_form_url text not null default '/images/patient consent.jpg',
  consent_version text not null default 'doc-kulot-procedure-consent-2026-08-01',
  consent_snapshot jsonb not null default '{}'::jsonb,
  procedure_explained boolean not null default true,
  outcomes_vary_acknowledged boolean not null default true,
  risk_acknowledged boolean not null default true,
  liability_acknowledged boolean not null default true,
  withdrawal_acknowledged boolean not null default true,
  voluntary_acknowledged boolean not null default true,
  aftercare_acknowledged boolean not null default true,
  aftercare_guide_title text,
  aftercare_image_url text,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(procedure_name) <> ''),
  check (btrim(patient_name) <> ''),
  check (btrim(patient_signature) <> '')
);

create unique index if not exists patient_procedure_consents_reservation_unique
  on public.patient_procedure_consents(reservation_id)
  where reservation_id is not null;

create index if not exists patient_procedure_consents_patient_idx
  on public.patient_procedure_consents(patient_id, signed_at desc);

create index if not exists patient_procedure_consents_appointment_idx
  on public.patient_procedure_consents(appointment_id)
  where appointment_id is not null;

drop trigger if exists patient_procedure_consents_updated_at on public.patient_procedure_consents;
create trigger patient_procedure_consents_updated_at
  before update on public.patient_procedure_consents
  for each row execute function public.set_updated_at();

alter table public.patient_procedure_consents enable row level security;

drop policy if exists "patient_procedure_consents_read" on public.patient_procedure_consents;
create policy "patient_procedure_consents_read" on public.patient_procedure_consents
  for select using (public.is_clinic_staff() or patient_id = auth.uid());

drop policy if exists "patient_procedure_consents_patient_insert" on public.patient_procedure_consents;
create policy "patient_procedure_consents_patient_insert" on public.patient_procedure_consents
  for insert with check (public.is_clinic_staff() or patient_id = auth.uid());

drop policy if exists "staff_patient_procedure_consents_write" on public.patient_procedure_consents;
create policy "staff_patient_procedure_consents_write" on public.patient_procedure_consents
  for all using (public.is_clinic_staff()) with check (public.is_clinic_staff());
