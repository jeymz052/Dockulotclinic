alter table public.landing_content
  add column if not exists blog_categories jsonb not null default '[]'::jsonb;
