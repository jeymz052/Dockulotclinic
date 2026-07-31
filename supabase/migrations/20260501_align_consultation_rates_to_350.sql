alter table public.doctors
  alter column consultation_fee_clinic set default 800,
  alter column consultation_fee_online set default 800;

update public.doctors
set
  consultation_fee_clinic = 800,
  consultation_fee_online = 800
where slug = 'doctora-kulot-md';

alter table public.system_settings
  alter column online_consultation_fee set default 800;

update public.system_settings
set online_consultation_fee = 800
where id = true;
