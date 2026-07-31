-- Phase 2 of landing-page CMS: extend `landing_content` with the
-- navigation menu, services, how-to-book steps, section headers,
-- and footer.
--
-- All defaults mirror the current hardcoded copy in app/page.tsx so
-- existing installs keep their current rendering after this migration
-- runs. Re-run safe via `add column if not exists`.

alter table public.landing_content
  -- Navigation menu (top bar). Each entry is an in-page anchor by
  -- default; href is just a string so admins can also point to a
  -- different route if they ever add one.
  add column if not exists nav_items jsonb not null default '[
    {"label":"Home","href":"#home"},
    {"label":"Services","href":"#services"},
    {"label":"About","href":"#about"},
    {"label":"Testimonials","href":"#testimonials"}
  ]'::jsonb,

  -- Services & Pricing section header
  add column if not exists services_eyebrow text not null default 'Our Services',
  add column if not exists services_title text not null default 'Services & Pricing',
  add column if not exists services_subtitle text not null default 'Transparent pricing for both clinic and online consultations',

  -- Service cards. `kind` is purely cosmetic — drives icon + accent color
  -- in the UI. Keep two cards by default (Clinic / Online).
  add column if not exists services jsonb not null default '[
    {"kind":"clinic","title":"Clinic Visit","description":"In-person consultation at our facility","bullets":[
      {"title":"Direct Examination","body":"Thorough medical assessment"},
      {"title":"Face-to-Face Interaction","body":"Better for complex conditions"},
      {"title":"Prescription Services","body":"Direct access to prescriptions"}
    ]},
    {"kind":"online","title":"Online Consultation","description":"Remote consultation from the comfort of your home","bullets":[
      {"title":"Video Call","body":"Secure and private consultation"},
      {"title":"Convenient Timing","body":"Book from anywhere, anytime"},
      {"title":"Online Payment","body":"Secure PayMongo integration"}
    ]}
  ]'::jsonb,

  -- How to Book section
  add column if not exists how_to_eyebrow text not null default 'Simple Process',
  add column if not exists how_to_title text not null default 'How to Book Your Appointment',
  add column if not exists how_to_steps jsonb not null default '[
    {"step":1,"title":"Sign In","description":"Create an account or log in to your existing account"},
    {"step":2,"title":"Choose Service","description":"Select clinic visit or online consultation"},
    {"step":3,"title":"Pick Date & Time","description":"Choose your preferred appointment slot"},
    {"step":4,"title":"Confirm & Pay","description":"Review details and complete secure payment"}
  ]'::jsonb,

  -- Testimonials section header (rows already in `testimonials` column)
  add column if not exists testimonials_eyebrow text not null default 'Patient Stories',
  add column if not exists testimonials_title text not null default 'What Patients Say',
  add column if not exists testimonials_subtitle text not null default 'Trusted care, thoughtful consultations, and a booking experience designed to feel simple and supportive.',

  -- Booking section wrapper (the title/subtitle shown above the booking widget)
  add column if not exists booking_title text not null default 'Book an Appointment',
  add column if not exists booking_subtitle text not null default 'Use the booking widget below to pick service, date and time. You will be prompted to sign in or create an account before final confirmation.',

  -- Contact section
  add column if not exists contact_eyebrow text not null default 'Get in Touch',
  add column if not exists contact_title text not null default 'Contact Doc Kulot',
  add column if not exists contact_subtitle text not null default 'Have questions or need help booking? Send us a message or call us — we''re here to help.',
  add column if not exists contact_info_title text not null default 'Contact Info',
  add column if not exists contact_hours_label text not null default 'Office Hours: Mon - Fri, 8:00 AM - 5:00 PM',

  -- Footer
  add column if not exists footer_brand_blurb text not null default 'Expert healthcare from Dr. Fatimah Al-Zahra T. Ditti.',
  add column if not exists footer_services jsonb not null default '["Clinic Visits","Online Consultations","Appointments"]'::jsonb,
  add column if not exists footer_hours jsonb not null default '["Mon - Fri: 8:00 AM - 5:00 PM","Sat: By Appointment","Sun: Closed"]'::jsonb,
  add column if not exists footer_contact_text text not null default 'Visit our contact section above to send a message or call us directly.',
  add column if not exists footer_copyright text not null default '© 2026 Doc Kulot. All rights reserved.';
