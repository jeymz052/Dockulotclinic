-- Clean up any orphaned records in public.patients for accounts that are staff, secretary, doctor, admin, or super_admin
-- and have no referencing appointments.
delete from public.patients
where id in (
  select p.id
  from public.patients p
  join public.profiles pr on pr.id = p.id
  where pr.role != 'patient'
)
and id not in (
  select patient_id from public.appointments
);
