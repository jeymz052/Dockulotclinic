-- Restore the public About section copy/image to the previous landing-page
-- version and stop the Website Content editor from surfacing older defaults.

alter table public.landing_content
  add column if not exists about_eyebrow text not null default 'About the Doctor',
  add column if not exists about_title text not null default 'Dr. Fatimah Al-Zahra T. Ditti (Doc Kulot) | Injector Queen',
  add column if not exists about_subtitle text not null default 'Doc Kulot is a Family Medicine and Aesthetic Medicine doctor focused on family care, women''s health, telemedicine, and procedure-based aesthetics.',
  add column if not exists doctor_name text not null default 'Dr. Fatimah Al-Zahra T. Ditti',
  add column if not exists doctor_title text not null default 'Family Medicine | Aesthetic Medicine',
  add column if not exists doctor_photo_url text,
  add column if not exists about_highlights jsonb not null default '[
    {"title":"Specialty","body":"Family Medicine and Aesthetic Medicine"},
    {"title":"Medical School","body":"Silliman University Medical School, 2017"},
    {"title":"Residency","body":"Zamboanga City Medical Center"},
    {"title":"Pre-Med","body":"BS Nursing, Western Mindanao State University"},
    {"title":"Care Focus","body":"Telemedicine, women''s health, weight loss, and procedures"}
  ]'::jsonb;

alter table public.landing_content
  alter column about_eyebrow set default 'About the Doctor',
  alter column about_title set default 'Dr. Fatimah Al-Zahra T. Ditti (Doc Kulot) | Injector Queen',
  alter column about_subtitle set default 'Doc Kulot is a Family Medicine and Aesthetic Medicine doctor focused on family care, women''s health, telemedicine, and procedure-based aesthetics.',
  alter column doctor_name set default 'Dr. Fatimah Al-Zahra T. Ditti',
  alter column doctor_title set default 'Family Medicine | Aesthetic Medicine',
  alter column about_highlights set default '[
    {"title":"Specialty","body":"Family Medicine and Aesthetic Medicine"},
    {"title":"Medical School","body":"Silliman University Medical School, 2017"},
    {"title":"Residency","body":"Zamboanga City Medical Center"},
    {"title":"Pre-Med","body":"BS Nursing, Western Mindanao State University"},
    {"title":"Care Focus","body":"Telemedicine, women''s health, weight loss, and procedures"}
  ]'::jsonb;

update public.landing_content
set
  about_eyebrow = 'About the Doctor',
  about_title = 'Dr. Fatimah Al-Zahra T. Ditti (Doc Kulot) | Injector Queen',
  about_subtitle = 'Doc Kulot is a Family Medicine and Aesthetic Medicine doctor focused on family care, women''s health, telemedicine, and procedure-based aesthetics.',
  doctor_name = 'Dr. Fatimah Al-Zahra T. Ditti',
  doctor_title = 'Family Medicine | Aesthetic Medicine',
  doctor_photo_url = null,
  about_highlights = '[
    {"title":"Specialty","body":"Family Medicine and Aesthetic Medicine"},
    {"title":"Medical School","body":"Silliman University Medical School, 2017"},
    {"title":"Residency","body":"Zamboanga City Medical Center"},
    {"title":"Pre-Med","body":"BS Nursing, Western Mindanao State University"},
    {"title":"Care Focus","body":"Telemedicine, women''s health, weight loss, and procedures"}
  ]'::jsonb
where id = true;
