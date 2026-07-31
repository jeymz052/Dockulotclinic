alter table public.landing_content
  add column if not exists blog_eyebrow text not null default 'Blogs',
  add column if not exists blog_title text not null default 'Fresh health tips from Doc Kulot',
  add column if not exists blog_subtitle text not null default 'Published blog and health tip posts are created in the internal creator system and surfaced here for visitors on the landing page.',
  add column if not exists blog_categories_title text not null default 'Categories',
  add column if not exists blog_recent_posts_title text not null default 'Recent Posts',
  add column if not exists blog_categories jsonb not null default '[
    "Health Tips",
    "Clinic Updates",
    "Medical Awareness",
    "Patient Education",
    "Online Consultation Topics",
    "Lifestyle & Wellness",
    "FAQ Videos",
    "Live Replays"
  ]'::jsonb,
  add column if not exists videos_eyebrow text not null default 'Videos',
  add column if not exists videos_title text not null default 'Doctor vlogs, replays, and featured Doc Kulot content',
  add column if not exists videos_subtitle text not null default 'Video and announcement posts published from the internal content creator platform appear here for public visitors and followers.',
  add column if not exists live_eyebrow text not null default 'Live Schedule',
  add column if not exists live_title text not null default 'Upcoming live health talks and webinar schedules',
  add column if not exists live_subtitle text not null default 'Followers can check the next live session, open the registration or stream link, and come back later for replays and follow-up content.',
  add column if not exists live_cta_label text not null default 'Open live schedule page';
