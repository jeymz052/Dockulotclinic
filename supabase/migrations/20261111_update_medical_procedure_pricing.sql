-- Update medical procedure prices and insert new procedures and sub-areas
insert into public.pricing (code, name, category, price, is_active)
values
  ('PROC-BOTOX', 'Botox', 'Procedure', 6499, true),
  ('PROC-MESOLIPO', 'Mesolipo', 'Procedure', 3999, true),
  ('PROC-FILLERS', 'Fillers', 'Procedure', 8999, true),
  ('PROC-GLOWRX', 'GlowRx Program', 'Procedure', 9999, true),
  ('PROC-BOTOX-WHOLE-FACE', 'Botox - Whole Face (incl Jawtox)', 'Procedure', 20999, true),
  ('PROC-BOTOX-JAWTOX', 'Botox - Jawtox', 'Procedure', 10999, true),
  ('PROC-BOTOX-FOREHEAD', 'Botox - Forehead', 'Procedure', 6999, true),
  ('PROC-BOTOX-ALARTOX', 'Botox - Alartox', 'Procedure', 6499, true),
  ('PROC-BOTOX-NEFERTITI', 'Botox - Nefertiti', 'Procedure', 11999, true),
  ('PROC-BOTOX-BARBIE-ARM', 'Botox - Barbie Arm', 'Procedure', 14999, true),
  ('PROC-BOTOX-TRAPTOX', 'Botox - Traptox', 'Procedure', 14999, true),
  ('PROC-BOTOX-MESOLIFT', 'Botox - Mesolift', 'Procedure', 9999, true),
  ('PROC-MESOLIPO-CHIN', 'Mesolipo - Chin', 'Procedure', 3999, true),
  ('PROC-MESOLIPO-FACE', 'Mesolipo - Face', 'Procedure', 3999, true),
  ('PROC-MESOLIPO-ARMS', 'Mesolipo - Arms', 'Procedure', 5499, true),
  ('PROC-FILLERS-LIPS', 'Fillers - Lips', 'Procedure', 14499, true),
  ('PROC-FILLERS-CHIN', 'Fillers - Chin', 'Procedure', 8999, true),
  ('PROC-PINKGLOW', 'PinkGlow (Microneedle + Exosomes + Botox)', 'Procedure', 7499, true),
  ('PROC-REDGLOW', 'RedGlow (Microneedle + Exosomes + Botox)', 'Procedure', 7999, true),
  ('PROC-CRYSTALGLOW', 'CrystalGlow (Microneedle + Exosomes + Botox)', 'Procedure', 7499, true)
on conflict (code) do update
set
  name = excluded.name,
  category = excluded.category,
  price = excluded.price,
  is_active = excluded.is_active;

