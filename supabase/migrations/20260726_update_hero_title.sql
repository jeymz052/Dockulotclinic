-- Update hero title text to the new clinic messaging.
update public.landing_content
set
  hero_title_line1 = 'Complete care,',
  hero_title_line2 = 'Trusted content'
where id = true;
