-- Update landing page images to use the new clinic branding assets.
-- These public paths map to files already present in /public/images/.
update public.landing_content
set
  hero_background_url = '/images/dockulotbgs.png',
  doctor_photo_url = '/images/dockulots-removebg-preview.png'
where id = true;
