-- Complete Healthcare & Doctor Creator System
-- Fresh Supabase schema for a new project.
-- Run this in the Supabase SQL editor before using the app.

create extension if not exists "pgcrypto";

-- =========================================================
-- Helpers
-- =========================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- Access, Profiles, Doctor, Patient
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  phone text,
  full_name text not null,
  role text not null default 'patient'
    check (role in ('super_admin', 'admin', 'secretary', 'staff', 'doctor', 'patient')),
  is_active boolean not null default true,
  avatar_url text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_unique on public.profiles (lower(email));

-- These helpers depend on public.profiles, so they must be created after
-- the profiles table exists.
create or replace function public.current_profile_role()
returns text
language sql
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_clinic_staff()
returns boolean
language sql
stable
as $$
  select coalesce(public.current_profile_role() in ('super_admin', 'admin', 'secretary', 'doctor', 'staff'), false)
$$;

create table public.patients (
  id uuid primary key references public.profiles(id) on delete cascade,
  dob date,
  gender text,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  family_history text,
  allergies text,
  medical_history text,
  is_walk_in boolean not null default false,
  patient_category text not null default 'New'
    check (patient_category in ('New', 'Regular', 'OldRecord')),
  portal_notes_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.doctors (
  id uuid primary key references public.profiles(id) on delete cascade,
  slug text not null unique,
  specialty text not null default 'Family Medicine and Aesthetic Medicine',
  license_no text,
  bio text,
  consultation_fee_clinic numeric(12,2) not null default 600,
  consultation_fee_online numeric(12,2) not null default 800,
  default_meeting_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role text not null unique,
  permissions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.system_settings (
  id boolean primary key default true,
  clinic_name text not null default 'Doc Kulot',
  email text not null default 'admin@doctora-kulot.test',
  phone text not null default '',
  address text not null default '',
  online_consultation_fee numeric(12,2) not null default 800,
  max_patients_per_hour integer not null default 5,
  clinic_open_time time not null default '08:00',
  clinic_close_time time not null default '17:00',
  default_meeting_link text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint system_settings_singleton check (id)
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_table text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =========================================================
-- Services, Pricing, Schedules, Appointments
-- =========================================================
create table public.clinic_services (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null default 'Consultation',
  description text,
  service_mode text not null default 'Both' check (service_mode in ('Clinic', 'Online', 'Both')),
  base_price numeric(12,2) not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibility with the current POS/pricing screens.
create table public.pricing (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null,
  price numeric(12,2) not null default 0,
  service_id uuid references public.clinic_services(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.doctor_schedules (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_minutes integer not null default 60 check (slot_minutes > 0),
  schedule_mode text not null default 'Both' check (schedule_mode in ('Clinic', 'Online', 'Both')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time)
);

create table public.doctor_unavailability (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  service_id uuid references public.clinic_services(id) on delete set null,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  appointment_type text not null check (appointment_type in ('Clinic', 'Online')),
  status text not null default 'Pending'
    check (status in ('Pending', 'PendingPayment', 'Confirmed', 'CheckedIn', 'Checked In', 'InProgress', 'In Progress', 'Completed', 'Cancelled', 'NoShow', 'No Show')),
  queue_number integer not null default 1,
  reason text,
  symptoms text,
  meeting_link text,
  reminder_sent_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time)
);

create index appointments_patient_idx on public.appointments(patient_id);
create index appointments_doctor_date_idx on public.appointments(doctor_id, appointment_date);

create table public.online_booking_reservations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  appointment_type text not null default 'Online' check (appointment_type in ('Clinic', 'Online')),
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  queue_number integer not null default 1,
  reason text,
  amount numeric(12,2) not null default 0,
  status text not null default 'Pending' check (status in ('Pending', 'Paid', 'Failed', 'Expired', 'Converted')),
  payment_provider text,
  payment_ref text,
  appointment_id uuid references public.appointments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.online_consultations (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  concern text,
  file_urls jsonb not null default '[]'::jsonb,
  platform text default 'Google Meet',
  meeting_link text,
  status text not null default 'Pending' check (status in ('Pending', 'Confirmed', 'InProgress', 'Completed', 'Cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vital_signs (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid unique not null references public.appointments(id) on delete cascade,
  recorded_by uuid references public.profiles(id) on delete set null,
  bp_systolic smallint check (bp_systolic between 0 and 300),
  bp_diastolic smallint check (bp_diastolic between 0 and 200),
  temperature_c numeric(4,1) check (temperature_c between 25 and 45),
  pulse_rate smallint check (pulse_rate between 0 and 300),
  oxygen_saturation smallint check (oxygen_saturation between 0 and 100),
  respiratory_rate smallint check (respiratory_rate between 0 and 100),
  weight_kg numeric(5,2) check (weight_kg between 0 and 600),
  height_cm numeric(5,2) check (height_cm between 0 and 300),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- Diagnosis, Prescriptions, Patient Files
-- =========================================================
create table public.consultation_notes (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  chief_complaint text,
  diagnosis text,
  prescription text,
  notes text,
  visible_to_patient boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  diagnosis_text text not null,
  treatment_plan text,
  follow_up_date date,
  visible_to_patient boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  diagnosis_id uuid references public.diagnoses(id) on delete set null,
  prescription_no text not null unique default ('RX-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  general_instructions text,
  follow_up_date date,
  pdf_url text,
  released_to_patient boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  medicine_name text not null,
  dosage text,
  frequency text,
  duration text,
  instructions text,
  sort_order integer not null default 0
);

create table public.patient_files (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  file_name text not null,
  file_url text not null,
  file_type text,
  visible_to_patient boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index online_booking_reservations_payment_ref_unique
  on public.online_booking_reservations(payment_ref)
  where payment_ref is not null;

create table public.patient_procedure_consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  reservation_id uuid references public.online_booking_reservations(id) on delete set null,
  procedure_name text not null,
  patient_name text not null,
  patient_signature text not null,
  witness_name text,
  witness_signature text,
  witness_signed_at timestamptz,
  physician_name text,
  physician_signature text,
  physician_signed_at timestamptz,
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

create unique index patient_procedure_consents_reservation_unique
  on public.patient_procedure_consents(reservation_id)
  where reservation_id is not null;
create index patient_procedure_consents_patient_idx on public.patient_procedure_consents(patient_id, signed_at desc);
create index patient_procedure_consents_appointment_idx
  on public.patient_procedure_consents(appointment_id)
  where appointment_id is not null;

create table public.follow_up_inquiries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  message text not null,
  reply text,
  status text not null default 'Pending' check (status in ('Pending', 'Replied', 'Closed')),
  replied_by uuid references public.profiles(id) on delete set null,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- Billing, POS, Payments
-- =========================================================
create table public.billings (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  patient_id uuid not null references public.patients(id) on delete restrict,
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  status text not null default 'Draft' check (status in ('Draft', 'Issued', 'Paid', 'Void')),
  discount_kind text not null default 'None' check (discount_kind in ('None', 'Manual', 'SeniorCitizen', 'PWD')),
  discount_id_number text,
  issued_at timestamptz,
  voided_at timestamptz,
  voided_by uuid references public.profiles(id) on delete set null,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_items (
  id uuid primary key default gen_random_uuid(),
  billing_id uuid not null references public.billings(id) on delete cascade,
  pricing_id uuid references public.pricing(id) on delete set null,
  product_id uuid,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  billing_id uuid references public.billings(id) on delete set null,
  amount numeric(12,2) not null default 0,
  method text not null default 'Cash' check (method in ('Cash', 'GCash', 'QR', 'Card', 'BankTransfer')),
  status text not null default 'Pending' check (status in ('Pending', 'Paid', 'Failed', 'Refunded')),
  provider text,
  provider_ref text,
  tendered_amount numeric(12,2),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index payments_provider_ref_unique
  on public.payments(provider_ref)
  where provider_ref is not null;

-- =========================================================
-- Inventory
-- =========================================================
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  brand_name text,
  generic_name text,
  dosage text,
  category text not null default 'Medicine',
  description text,
  supplier_id uuid references public.suppliers(id) on delete set null,
  unit text not null default 'pc',
  cost_price numeric(12,2) not null default 0,
  selling_price numeric(12,2) not null default 0,
  stock_qty numeric(12,2) not null default 0,
  reorder_level numeric(12,2) not null default 0,
  expiry_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inventory_products_brand_name_idx on public.inventory_products (brand_name);

alter table public.billing_items
  add constraint billing_items_product_fk
  foreign key (product_id) references public.inventory_products(id) on delete set null;

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.inventory_products(id) on delete cascade,
  movement_type text not null check (movement_type in ('StockIn', 'StockOut', 'Sale', 'Return', 'Adjustment', 'Expired')),
  quantity numeric(12,2) not null,
  reference_table text,
  reference_id uuid,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- =========================================================
-- Website, Creator Content, Live Events, FAQ, Inquiries
-- =========================================================
create table public.landing_content (
  id boolean primary key default true,
  hero_eyebrow text not null default 'Healthcare & Doctor Creator Platform',
  hero_title_line1 text not null default 'Complete care,',
  hero_title_line2 text not null default 'trusted content',
  hero_subtitle text not null default 'Book clinic visits, telemedicine, and procedure-only visits with flexible scheduling and careful follow-up.',
  hero_cta_primary text not null default 'Book Appointment',
  hero_cta_secondary text not null default 'View Services',
  hero_background_url text,
  about_eyebrow text not null default 'About the Doctor',
  about_title text not null default 'Dr. Fatimah Al-Zahra T. Ditti',
  about_subtitle text not null default 'Family Medicine and Aesthetic Medicine doctor focused on telemedicine, women''s health, procedure support, and practical family care.',
  doctor_name text not null default 'Dr. Fatimah Al-Zahra T. Ditti',
  doctor_title text not null default 'Family Medicine | Aesthetic Medicine',
  about_highlights jsonb not null default '[
    {"title":"Specialty","body":"Family Medicine and Aesthetic Medicine"},
    {"title":"Medical School","body":"Silliman University Medical School, 2017"},
    {"title":"Residency","body":"Zamboanga City Medical Center"},
    {"title":"Pre-Med","body":"BS Nursing, Western Mindanao State University"},
    {"title":"Care Focus","body":"Telemedicine, women''s health, weight loss, and procedures"}
  ]'::jsonb,
  doctor_photo_url text,
  feature_1_title text not null default 'Specialty',
  feature_1_body text not null default 'Family Medicine and Aesthetic Medicine',
  feature_2_title text not null default 'Medical School',
  feature_2_body text not null default 'Silliman University Medical School, 2017',
  feature_3_title text not null default 'Residency',
  feature_3_body text not null default 'Zamboanga City Medical Center',
  cta_title text not null default 'Ready to schedule?',
  cta_subtitle text not null default 'Choose a service, date, and time.',
  cta_button_label text not null default 'Book Appointment',
  testimonials jsonb not null default '[]'::jsonb,
  nav_items jsonb not null default '[]'::jsonb,
  services_eyebrow text not null default 'Services',
  services_title text not null default 'Clinic and online services',
  services_subtitle text not null default 'Review available services before booking.',
  services jsonb not null default '[]'::jsonb,
  how_to_eyebrow text not null default 'How to book',
  how_to_title text not null default 'Simple appointment booking',
  how_to_steps jsonb not null default '[]'::jsonb,
  testimonials_eyebrow text not null default 'Patient Stories',
  testimonials_title text not null default 'What patients say',
  testimonials_subtitle text not null default 'Trusted care and helpful patient education.',
  booking_title text not null default 'Book an appointment',
  booking_subtitle text not null default 'Select service, date, and time.',
  contact_eyebrow text not null default 'Contact',
  contact_title text not null default 'Contact Doc Kulot',
  contact_subtitle text not null default 'Ask about appointments, services, consultations, or collaborations.',
  contact_info_title text not null default 'Contact Info',
  contact_hours_label text not null default 'Office Hours: Mon - Fri, 8:00 AM - 5:00 PM',
  footer_brand_blurb text not null default 'Expert healthcare from Dr. Fatimah Al-Zahra T. Ditti.',
  footer_services jsonb not null default '[]'::jsonb,
  footer_hours jsonb not null default '[]'::jsonb,
  footer_contact_text text not null default 'Use the contact page to send a message.',
  footer_copyright text not null default '© 2026 Doc Kulot. All rights reserved.',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint landing_content_singleton check (id)
);

create table public.content_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete set null,
  title text not null,
  slug text not null unique,
  content_type text not null check (content_type in ('Blog', 'HealthTip', 'Video', 'Announcement', 'LiveReplay')),
  category text not null,
  excerpt text,
  body text,
  embed_url text,
  thumbnail_url text,
  is_featured boolean not null default false,
  status text not null default 'Draft' check (status in ('Draft', 'Published', 'Archived')),
  published_at timestamptz,
  view_count integer not null default 0,
  appointment_click_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.live_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz not null,
  platform text,
  live_url text,
  replay_post_id uuid references public.content_posts(id) on delete set null,
  registration_enabled boolean not null default true,
  status text not null default 'Upcoming' check (status in ('Upcoming', 'Live', 'Completed', 'Cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.live_event_registrations (
  id uuid primary key default gen_random_uuid(),
  live_event_id uuid not null references public.live_events(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  question text not null,
  answer text not null,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  inquiry_type text not null default 'General',
  message text not null,
  status text not null default 'Pending' check (status in ('Pending', 'Replied', 'Closed')),
  reply text,
  replied_by uuid references public.profiles(id) on delete set null,
  replied_at timestamptz,
  converted_appointment_id uuid references public.appointments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- Notifications and Reports Support
-- =========================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  channel text not null default 'email' check (channel in ('email', 'sms')),
  template text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  send_at timestamptz not null default now(),
  sent_at timestamptz,
  is_read boolean not null default false,
  error text,
  created_at timestamptz not null default now()
);

create index notifications_unread_idx
  on public.notifications(user_id, is_read, created_at desc)
  where is_read = false;

create table public.website_analytics (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  path text,
  content_post_id uuid references public.content_posts(id) on delete set null,
  service_id uuid references public.clinic_services(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =========================================================
-- Updated-at triggers
-- =========================================================
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger patients_updated_at before update on public.patients for each row execute function public.set_updated_at();
create trigger doctors_updated_at before update on public.doctors for each row execute function public.set_updated_at();
create trigger system_settings_updated_at before update on public.system_settings for each row execute function public.set_updated_at();
create trigger services_updated_at before update on public.clinic_services for each row execute function public.set_updated_at();
create trigger pricing_updated_at before update on public.pricing for each row execute function public.set_updated_at();
create trigger schedules_updated_at before update on public.doctor_schedules for each row execute function public.set_updated_at();
create trigger appointments_updated_at before update on public.appointments for each row execute function public.set_updated_at();
create trigger reservations_updated_at before update on public.online_booking_reservations for each row execute function public.set_updated_at();
create trigger online_consultations_updated_at before update on public.online_consultations for each row execute function public.set_updated_at();
create trigger vital_signs_updated_at before update on public.vital_signs for each row execute function public.set_updated_at();
create trigger consultation_notes_updated_at before update on public.consultation_notes for each row execute function public.set_updated_at();
create trigger diagnoses_updated_at before update on public.diagnoses for each row execute function public.set_updated_at();
create trigger prescriptions_updated_at before update on public.prescriptions for each row execute function public.set_updated_at();
create trigger patient_procedure_consents_updated_at before update on public.patient_procedure_consents for each row execute function public.set_updated_at();
create trigger follow_up_inquiries_updated_at before update on public.follow_up_inquiries for each row execute function public.set_updated_at();
create trigger billings_updated_at before update on public.billings for each row execute function public.set_updated_at();
create trigger suppliers_updated_at before update on public.suppliers for each row execute function public.set_updated_at();
create trigger inventory_products_updated_at before update on public.inventory_products for each row execute function public.set_updated_at();
create trigger landing_content_updated_at before update on public.landing_content for each row execute function public.set_updated_at();
create trigger content_posts_updated_at before update on public.content_posts for each row execute function public.set_updated_at();
create trigger live_events_updated_at before update on public.live_events for each row execute function public.set_updated_at();
create trigger faqs_updated_at before update on public.faqs for each row execute function public.set_updated_at();
create trigger inquiries_updated_at before update on public.inquiries for each row execute function public.set_updated_at();

-- =========================================================
-- RLS
-- =========================================================
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.doctors enable row level security;
alter table public.role_permissions enable row level security;
alter table public.system_settings enable row level security;
alter table public.activity_logs enable row level security;
alter table public.clinic_services enable row level security;
alter table public.pricing enable row level security;
alter table public.doctor_schedules enable row level security;
alter table public.doctor_unavailability enable row level security;
alter table public.appointments enable row level security;
alter table public.online_booking_reservations enable row level security;
alter table public.online_consultations enable row level security;
alter table public.vital_signs enable row level security;
alter table public.consultation_notes enable row level security;
alter table public.diagnoses enable row level security;
alter table public.prescriptions enable row level security;
alter table public.prescription_items enable row level security;
alter table public.patient_files enable row level security;
alter table public.patient_procedure_consents enable row level security;
alter table public.follow_up_inquiries enable row level security;
alter table public.billings enable row level security;
alter table public.billing_items enable row level security;
alter table public.payments enable row level security;
alter table public.suppliers enable row level security;
alter table public.inventory_products enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.landing_content enable row level security;
alter table public.content_posts enable row level security;
alter table public.live_events enable row level security;
alter table public.live_event_registrations enable row level security;
alter table public.faqs enable row level security;
alter table public.inquiries enable row level security;
alter table public.notifications enable row level security;
alter table public.website_analytics enable row level security;

create policy "profiles_self_or_staff_read" on public.profiles for select using (id = auth.uid() or public.is_clinic_staff());
create policy "profiles_self_update" on public.profiles for update using (id = auth.uid() or public.is_clinic_staff());

create policy "patients_self_or_staff" on public.patients for select using (id = auth.uid() or public.is_clinic_staff());
create policy "patients_staff_write" on public.patients for all using (public.is_clinic_staff()) with check (public.is_clinic_staff());

create policy "public_doctor_read" on public.doctors for select using (true);
create policy "staff_doctor_write" on public.doctors for all using (public.is_clinic_staff()) with check (public.is_clinic_staff());
create policy "settings_authenticated_read" on public.system_settings for select using (auth.uid() is not null);
create policy "settings_doctor_admin_write" on public.system_settings
  for all using (public.current_profile_role() in ('super_admin', 'admin', 'doctor'))
  with check (public.current_profile_role() in ('super_admin', 'admin', 'doctor'));

create policy "public_service_read" on public.clinic_services for select using (is_active = true or public.is_clinic_staff());
create policy "staff_service_write" on public.clinic_services for all using (public.is_clinic_staff()) with check (public.is_clinic_staff());

create policy "staff_pricing_all" on public.pricing for all using (public.is_clinic_staff()) with check (public.is_clinic_staff());
create policy "staff_schedules_all" on public.doctor_schedules for all using (public.is_clinic_staff()) with check (public.is_clinic_staff());
create policy "staff_unavailability_all" on public.doctor_unavailability for all using (public.is_clinic_staff()) with check (public.is_clinic_staff());

create policy "appointments_patient_or_staff_read" on public.appointments
  for select using (patient_id = auth.uid() or doctor_id = auth.uid() or public.is_clinic_staff());
create policy "appointments_patient_create" on public.appointments
  for insert with check (patient_id = auth.uid() or public.is_clinic_staff());
create policy "appointments_staff_update" on public.appointments
  for update using (public.is_clinic_staff() or patient_id = auth.uid());

create policy "patient_or_staff_related_online" on public.online_consultations
  for select using (
    public.is_clinic_staff()
    or exists (select 1 from public.appointments a where a.id = appointment_id and a.patient_id = auth.uid())
  );
create policy "staff_online_write" on public.online_consultations for all using (public.is_clinic_staff()) with check (public.is_clinic_staff());

create policy "patient_visible_notes" on public.consultation_notes
  for select using (
    public.is_clinic_staff()
    or exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.patient_id = auth.uid() and visible_to_patient
    )
  );
create policy "staff_notes_write" on public.consultation_notes for all using (public.is_clinic_staff()) with check (public.is_clinic_staff());

create policy "patient_visible_diagnoses" on public.diagnoses for select using (public.is_clinic_staff() or (patient_id = auth.uid() and visible_to_patient));
create policy "staff_diagnoses_write" on public.diagnoses for all using (public.is_clinic_staff()) with check (public.is_clinic_staff());

create policy "patient_released_prescriptions" on public.prescriptions for select using (public.is_clinic_staff() or (patient_id = auth.uid() and released_to_patient));
create policy "staff_prescriptions_write" on public.prescriptions for all using (public.is_clinic_staff()) with check (public.is_clinic_staff());
create policy "prescription_items_parent_access" on public.prescription_items
  for select using (
    exists (select 1 from public.prescriptions p where p.id = prescription_id and (public.is_clinic_staff() or (p.patient_id = auth.uid() and p.released_to_patient)))
  );
create policy "staff_prescription_items_write" on public.prescription_items for all using (public.is_clinic_staff()) with check (public.is_clinic_staff());

create policy "patient_files_visible" on public.patient_files for select using (public.is_clinic_staff() or (patient_id = auth.uid() and visible_to_patient));
create policy "staff_patient_files_write" on public.patient_files for all using (public.is_clinic_staff()) with check (public.is_clinic_staff());
create policy "patient_procedure_consents_read" on public.patient_procedure_consents
  for select using (public.is_clinic_staff() or patient_id = auth.uid());
create policy "patient_procedure_consents_patient_insert" on public.patient_procedure_consents
  for insert with check (public.is_clinic_staff() or patient_id = auth.uid());
create policy "staff_patient_procedure_consents_write" on public.patient_procedure_consents
  for all using (public.is_clinic_staff()) with check (public.is_clinic_staff());

create policy "billing_patient_or_staff" on public.billings for select using (patient_id = auth.uid() or public.is_clinic_staff());
create policy "staff_billing_write" on public.billings for all using (public.is_clinic_staff()) with check (public.is_clinic_staff());
create policy "billing_items_staff_or_parent_patient" on public.billing_items
  for select using (public.is_clinic_staff() or exists (select 1 from public.billings b where b.id = billing_id and b.patient_id = auth.uid()));
create policy "staff_billing_items_write" on public.billing_items for all using (public.is_clinic_staff()) with check (public.is_clinic_staff());
create policy "payments_patient_or_staff" on public.payments
  for select using (
    public.is_clinic_staff()
    or exists (select 1 from public.billings b where b.id = billing_id and b.patient_id = auth.uid())
    or exists (select 1 from public.appointments a where a.id = appointment_id and a.patient_id = auth.uid())
  );
create policy "staff_payments_write" on public.payments for all using (public.is_clinic_staff()) with check (public.is_clinic_staff());

create policy "staff_inventory_all" on public.suppliers for all using (public.is_clinic_staff()) with check (public.is_clinic_staff());
create policy "staff_products_all" on public.inventory_products for all using (public.is_clinic_staff()) with check (public.is_clinic_staff());
create policy "staff_movements_all" on public.inventory_movements for all using (public.is_clinic_staff()) with check (public.is_clinic_staff());

create policy "public_landing_read" on public.landing_content for select using (true);
create policy "doctor_landing_write" on public.landing_content for all using (public.current_profile_role() in ('super_admin', 'doctor')) with check (public.current_profile_role() in ('super_admin', 'doctor'));
create policy "public_published_content" on public.content_posts for select using (status = 'Published' or public.is_clinic_staff());
create policy "doctor_content_write" on public.content_posts for all using (public.current_profile_role() in ('super_admin', 'doctor')) with check (public.current_profile_role() in ('super_admin', 'doctor'));
create policy "public_live_read" on public.live_events for select using (status <> 'Cancelled' or public.is_clinic_staff());
create policy "doctor_live_write" on public.live_events for all using (public.current_profile_role() in ('super_admin', 'doctor')) with check (public.current_profile_role() in ('super_admin', 'doctor'));
create policy "public_faq_read" on public.faqs for select using (is_published or public.is_clinic_staff());
create policy "staff_faq_write" on public.faqs for all using (public.is_clinic_staff()) with check (public.is_clinic_staff());

create policy "public_inquiry_insert" on public.inquiries for insert with check (true);
create policy "staff_inquiry_manage" on public.inquiries for all using (public.is_clinic_staff()) with check (public.is_clinic_staff());
create policy "public_live_registration_insert" on public.live_event_registrations for insert with check (true);
create policy "staff_live_registration_read" on public.live_event_registrations for select using (public.is_clinic_staff());

create policy "notifications_own" on public.notifications for select using (user_id = auth.uid() or public.is_clinic_staff());
create policy "notifications_staff_write" on public.notifications for all using (public.is_clinic_staff()) with check (public.is_clinic_staff());

create policy "analytics_insert" on public.website_analytics for insert with check (true);
create policy "analytics_staff_read" on public.website_analytics for select using (public.is_clinic_staff());
create policy "staff_logs_read" on public.activity_logs for select using (public.is_clinic_staff());

-- =========================================================
-- Seed reference data
-- =========================================================
insert into public.landing_content (id) values (true)
on conflict (id) do nothing;

insert into public.system_settings (id, clinic_name, email, phone, address, online_consultation_fee, max_patients_per_hour)
values (true, 'Doc Kulot', 'info@dockulot.clinic', '+63 917 154 4754', 'Zamboanga City, Zamboanga del Sur', 800, 5)
on conflict (id) do nothing;

insert into public.clinic_services (code, name, category, description, service_mode, base_price, sort_order) values
  ('GEN-CONSULT', 'General Consultation', 'Consultation', 'First-time clinic consultation', 'Clinic', 600, 1),
  ('ONLINE-CONSULT', 'Telemedicine Services', 'Consultation', 'Weight loss management, PCOS management, chronic disease review, lab interpretation, and prescription refill', 'Online', 800, 2),
  ('FOLLOW-UP', 'Clinic Follow-up Consultation', 'Consultation', 'Regular follow-up visit and progress review', 'Clinic', 300, 3),
  ('MED-CERT', 'Medical Certificate Request', 'Document', 'Medical certificate after doctor approval', 'Clinic', 0, 4),
  ('LAB-REF', 'Laboratory Referral', 'Referral', 'Laboratory referral based on assessment', 'Both', 0, 5),
  ('RX-RENEW', 'Prescription Refill', 'Prescription', 'Medication refill review', 'Online', 800, 6),
  ('HEALTH-COACH', 'Women''s Health and Aesthetic Care', 'Wellness', 'PCOS, acne, hormonal acne, and weight loss support', 'Both', 800, 7),
  ('WELLNESS', 'Aesthetic Procedures', 'Wellness', 'Botox, Mesolipo, fillers, threads, sclerotherapy, GLP initiation, mole surgery, wart and skin tag removal', 'Clinic', 800, 8)
on conflict (code) do nothing;

insert into public.pricing (code, name, category, price, service_id)
select code, name, category, base_price, id from public.clinic_services
on conflict (code) do nothing;

insert into public.pricing (code, name, category, price)
values
  ('PROC-BOTOX', 'Botox', 'Procedure', 200),
  ('PROC-MESOLIPO', 'Mesolipo', 'Procedure', 4900),
  ('PROC-FILLERS', 'Fillers', 'Procedure', 4999),
  ('PROC-SCLEROTHERAPY', 'Sclerotherapy', 'Procedure', 5999),
  ('PROC-WART-REMOVAL', 'Wart Removal', 'Procedure', 2999),
  ('PROC-MOLE-SURGERY', 'Mole Surgery', 'Procedure', 6999)
on conflict (code) do update
set
  name = excluded.name,
  category = excluded.category,
  price = excluded.price;

insert into public.faqs (category, question, answer, sort_order) values
  ('Appointment FAQ', 'How to book an appointment?', 'Open the booking page, choose your service, select date and time, and submit your details.', 1),
  ('Clinic Services FAQ', 'Do you accept walk-in patients?', 'Walk-ins can be encoded by staff, but procedure days and limited clinic slots still follow the doctor''s posted schedule.', 2),
  ('Prescription FAQ', 'How can I access my prescription?', 'Log in to the patient portal and open your consultation or prescription history. Prescriptions can be viewed, printed, downloaded, or emailed as PDF.', 3),
  ('Online Consultation FAQ', 'How do I book an online consultation?', 'Choose telemedicine during booking and wait for confirmation and meeting details.', 4),
  ('Content FAQ', 'Where can I watch doctor videos?', 'Open the Videos page for educational videos and live replays.', 5)
on conflict do nothing;
