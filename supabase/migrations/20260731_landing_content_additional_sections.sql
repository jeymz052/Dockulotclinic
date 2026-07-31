-- Additional landing-page CMS fields for the current public section order.
-- These defaults mirror the live landing page so existing installs keep the
-- same copy until edited from the Website Content dashboard.

alter table public.landing_content
  add column if not exists program_slides jsonb not null default '[
    {"key":"glowrx","name":"GlowRx by Doc Kulot","description":"GlowRx by Doc Kulot is a comprehensive, evidence-based program that focuses on sustainable weight management while improving your overall health, confidence, and quality of life. Every plan is personalized and supervised throughout the journey. Glow beyond the scale. Because true beauty starts with better health.","ctaLabel":"Book a consultation"},
    {"key":"hormonerx","name":"HormoneRx by Doc Kulot","description":"HormoneRx by Doc Kulot is a personalized, evidence-based program designed for women experiencing hormonal imbalances such as PCOS, hormonal acne, irregular periods, insulin resistance, and other hormone-related concerns. Our goal is to treat the root cause, not just the symptoms, through compassionate, holistic, and medically supervised care.","ctaLabel":"Book a consultation"},
    {"key":"heartrx","name":"HeartRx by Doc Kulot","description":"HeartRx by Doc Kulot is to help prevent, detect, and manage cardiovascular diseases through personalized medical care, lifestyle medicine, and long-term follow-up. Whether you are living with hypertension, high cholesterol, diabetes, or simply want to reduce your cardiovascular risk, HeartRx focuses on keeping your heart healthy for life.","ctaLabel":"Book a consultation"},
    {"key":"metabolicrx","name":"MetabolicRx by Doc Kulot","description":"MetabolicRx by Doc Kulot is designed to help individuals prevent, manage, and reverse metabolic diseases through personalized medical care, lifestyle medicine, and continuous physician support. Whether you have prediabetes, diabetes, fatty liver disease, obesity, or metabolic syndrome, our goal is to optimize your health and reduce your risk of long-term complications.","ctaLabel":"Book a consultation"},
    {"key":"preventrx","name":"PreventRx by Doc Kulot","description":"PreventRx by Doc Kulot is a preventive care program focused on keeping you healthy before illness develops. Through regular health screenings, vaccinations, lifestyle medicine, and personalized risk assessments, we help you detect diseases early, reduce future health risks, and build a healthier future.","ctaLabel":"Book a consultation"}
  ]'::jsonb,

  add column if not exists results_eyebrow text not null default 'Before and After',
  add column if not exists results_title text not null default 'GlowRx and aesthetic results',
  add column if not exists results_subtitle text not null default 'Selected GlowRx weight-loss progress and aesthetic before-and-after outcomes.',

  add column if not exists faq_eyebrow text not null default 'FAQ',
  add column if not exists faq_title text not null default 'Quick answers for common questions for Doc Kulot patients',
  add column if not exists faq_subtitle text not null default 'Frequently asked questions now live on the landing page instead of a separate page.',

  add column if not exists contact_facebook_label text not null default 'Doc Kulot Facebook',
  add column if not exists contact_facebook_url text not null default 'https://www.facebook.com/share/1GnJA9tPm2/',
  add column if not exists contact_youtube_label text not null default 'Doc Kulot YouTube',
  add column if not exists contact_youtube_url text not null default 'https://www.youtube.com/@DocKulot';
