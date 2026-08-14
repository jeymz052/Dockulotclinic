  -- Patient self-service reschedule requests with staff/doctor approval.
  create table if not exists public.appointment_reschedule_requests (
    id uuid primary key default gen_random_uuid(),
    appointment_id uuid not null references public.appointments(id) on delete cascade,
    patient_id uuid not null references public.patients(id) on delete cascade,
    doctor_id uuid not null references public.doctors(id) on delete restrict,
    requested_appointment_date date not null,
    requested_start_time time not null,
    requested_end_time time not null,
    requested_appointment_type text not null check (requested_appointment_type in ('Clinic', 'Online')),
    reason text,
    status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected', 'Cancelled')),
    requested_by uuid references public.profiles(id) on delete set null,
    reviewed_by uuid references public.profiles(id) on delete set null,
    reviewed_at timestamptz,
    review_note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (requested_start_time < requested_end_time)
  );

  create index if not exists appointment_reschedule_requests_patient_idx
    on public.appointment_reschedule_requests(patient_id, status);
  create index if not exists appointment_reschedule_requests_doctor_idx
    on public.appointment_reschedule_requests(doctor_id, status);
  create unique index if not exists appointment_reschedule_requests_one_pending_idx
    on public.appointment_reschedule_requests(appointment_id)
    where status = 'Pending';

  drop trigger if exists appointment_reschedule_requests_updated_at on public.appointment_reschedule_requests;
  create trigger appointment_reschedule_requests_updated_at
    before update on public.appointment_reschedule_requests
    for each row execute function public.set_updated_at();

  alter table public.appointment_reschedule_requests enable row level security;

  drop policy if exists "reschedule_requests_participant_or_staff_read" on public.appointment_reschedule_requests;
  create policy "reschedule_requests_participant_or_staff_read" on public.appointment_reschedule_requests
    for select using (
      patient_id = auth.uid()
      or doctor_id = auth.uid()
      or public.is_clinic_staff()
    );
                
  drop policy if exists "reschedule_requests_patient_create" on public.appointment_reschedule_requests;
  create policy "reschedule_requests_patient_create" on public.appointment_reschedule_requests
    for insert with check (patient_id = auth.uid());

  drop policy if exists "reschedule_requests_staff_doctor_update" on public.appointment_reschedule_requests;
  create policy "reschedule_requests_staff_doctor_update" on public.appointment_reschedule_requests
    for update using (public.is_clinic_staff() or doctor_id = auth.uid())
    with check (public.is_clinic_staff() or doctor_id = auth.uid());
