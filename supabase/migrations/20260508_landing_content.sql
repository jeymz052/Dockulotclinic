-- Landing-page content manager
--
-- All editable copy + image references for the public landing page (app/page.tsx)
-- live in this single-row table so super_admin and doctor can edit through the
-- /contents page without redeploying. Images are uploaded to the
-- `landing-assets` Supabase Storage bucket; we store the *public URL* (or null
-- to fall back to the bundled defaults under /public/images/).
--
-- Why a singleton (id boolean primary key default true): same pattern used by
-- system_settings — there is exactly one landing page, no benefit from a row
-- per tenant, and select-without-where always hits the same row.
--
-- Testimonials are kept as a JSONB array because the shape is fixed
-- ({ name, title, quote }) but the count varies and sorting matters.

create table if not exists public.landing_content (
  id boolean primary key default true check (id),

  -- Hero (above-the-fold) ------------------------------------------------
  hero_eyebrow text not null default '',
  hero_title_line1 text not null default 'Complete care,',
  hero_title_line2 text not null default 'Trusted content',
  hero_subtitle text not null default 'Expert healthcare from Dr. Fatimah Al-Zahra T. Ditti. Book clinic visits or online consultations with flexibility and convenience.',
  hero_cta_primary text not null default 'Book Appointment Now',
  hero_cta_secondary text not null default 'Learn More',
  hero_background_url text,

  -- Doctor / About section ----------------------------------------------
  about_eyebrow text not null default 'About the Doctor',
  about_title text not null default 'Dr. Fatimah Al-Zahra Ditti',
  about_subtitle text not null default 'Medical Doctor focused on family medicine, women''s health, preventive care, and everyday primary care support for patients and families.',
  doctor_name text not null default 'Dr. Fatimah Al-Zahra Ditti',
  doctor_title text not null default 'Medical Doctor',
  about_highlights jsonb not null default '[
    {"title":"Specialty","body":"Family Medicine"},
    {"title":"Experience","body":"8 Years of clinical practice"},
    {"title":"Subspecialty","body":"PCOS Management and Weightloss Management"},
    {"title":"Care Focus","body":"Primary care, prevention, and follow-up support"},
    {"title":"Education","body":"Silliman University, 2017 | Zamboanga City Medical Center, 2021"}
  ]'::jsonb,
  doctor_photo_url text,
  feature_1_title text not null default 'Specialty',
  feature_1_body text not null default 'Family Medicine',
  feature_2_title text not null default 'Experience',
  feature_2_body text not null default '8 Years',
  feature_3_title text not null default 'Subspecialty',
  feature_3_body text not null default 'PCOS Management and Weightloss Management',

  -- Closing CTA banner ---------------------------------------------------
  cta_title text not null default 'Ready to Schedule Your Appointment?',
  cta_subtitle text not null default 'Book now with Dr. Fatimah Al-Zahra T. Ditti. Flexible scheduling for clinic and online consultations.',
  cta_button_label text not null default 'Book Appointment Now',

  -- Testimonials ([{ name, title, quote }, ...]) ------------------------
  testimonials jsonb not null default '[]'::jsonb,

  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

-- Seed the singleton row on first install. Uses on conflict do nothing so
-- re-running the migration is safe.
insert into public.landing_content (id) values (true)
on conflict (id) do nothing;

-- Reuse the shared updated_at trigger.
do $$ begin
  create trigger trg_landing_content_updated before update on public.landing_content
    for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

alter table public.landing_content enable row level security;

-- Read: PUBLIC (anyone, including the unauthenticated landing-page visitor).
-- The landing page must hydrate without a session; otherwise the public
-- URL is useless as a marketing surface.
drop policy if exists landing_read on public.landing_content;
create policy landing_read on public.landing_content for select
  using (true);

-- Write: super_admin or the doctor. Doctor explicitly granted so the
-- single-doctor practice owner can self-serve content edits without an
-- admin handoff.
drop policy if exists landing_write on public.landing_content;
create policy landing_write on public.landing_content for all
  using (public.current_role() in ('super_admin', 'doctor'))
  with check (public.current_role() in ('super_admin', 'doctor'));

-- ---------- STORAGE BUCKET FOR LANDING IMAGES ----------
-- Public-read bucket so <Image src="..."> works without signed URLs.
-- Upload restricted to super_admin / doctor via storage.objects RLS below.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'landing-assets',
  'landing-assets',
  true,
  10485760, -- 10 MiB cap; landing-page imagery doesn't need to be larger
  array['image/png','image/jpeg','image/webp','image/avif','image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects already has RLS enabled by Supabase. Add our own policies
-- scoped to this bucket so super_admin / doctor can write, anyone can read.
drop policy if exists landing_assets_read on storage.objects;
create policy landing_assets_read on storage.objects for select
  using (bucket_id = 'landing-assets');

drop policy if exists landing_assets_write on storage.objects;
create policy landing_assets_write on storage.objects for all
  to authenticated
  using (bucket_id = 'landing-assets' and public.current_role() in ('super_admin', 'doctor'))
  with check (bucket_id = 'landing-assets' and public.current_role() in ('super_admin', 'doctor'));
