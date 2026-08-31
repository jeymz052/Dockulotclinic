-- Adds editable background image URL for shared Sign In and Sign Up auth pages.
alter table public.landing_content
  add column if not exists auth_background_url text;
