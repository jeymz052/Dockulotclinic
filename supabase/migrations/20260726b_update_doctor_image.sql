-- Update doctor profile image to the new transparent preview asset.
update public.landing_content
set
  doctor_photo_url = '/images/dockulots-removebg-preview.png'
where id = true;
