alter table public.patients
  add column if not exists patient_category text not null default 'New'
    check (patient_category in ('New', 'Regular', 'OldRecord'));

update public.patients
set patient_category = coalesce(patient_category, 'New')
where patient_category is null;

alter table public.doctors
  alter column consultation_fee_clinic set default 600;

alter table public.doctors
  alter column consultation_fee_online set default 800;

update public.doctors
set
  consultation_fee_clinic = 600,
  consultation_fee_online = 800
where consultation_fee_clinic = 800
   or consultation_fee_online = 800;

insert into public.pricing (code, name, category, price)
values
  ('GEN-CONSULT', 'General Consultation', 'Consultation', 600),
  ('FOLLOW-UP', 'Clinic Follow-up Consultation', 'Consultation', 300),
  ('ONLINE-CONSULT', 'Telemedicine Services', 'Consultation', 800),
  ('PROC-BOTOX', 'Botox', 'Procedure', 200),
  ('PROC-MESOLIPO', 'Mesolipo', 'Procedure', 4900),
  ('PROC-FILLERS', 'Fillers', 'Procedure', 4999),
  ('PROC-SCLEROTHERAPY', 'Sclerotherapy', 'Procedure', 5999),
  ('PROC-WART-REMOVAL', 'Wart Removal', 'Procedure', 2999),
  ('PROC-MOLE-SURGERY', 'Mole Surgery', 'Procedure', 6999)
on conflict (code) do update
set
  name = excluded.name,
  category = excluded.category,
  price = excluded.price;
