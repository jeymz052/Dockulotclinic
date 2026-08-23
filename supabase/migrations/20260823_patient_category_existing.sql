do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'patients'
      and column_name = 'patient_category'
  ) then
    execute 'alter table public.patients drop constraint if exists patients_patient_category_check';
    execute 'update public.patients set patient_category = ''Existing'' where patient_category in (''Regular'', ''OldRecord'')';
    execute 'alter table public.patients alter column patient_category set default ''New''';
    execute 'alter table public.patients add constraint patients_patient_category_check check (patient_category in (''New'', ''Existing''))';
  else
    execute 'alter table public.patients add column patient_category text not null default ''New''';
    execute 'update public.patients set patient_category = ''Existing''';
    execute 'alter table public.patients add constraint patients_patient_category_check check (patient_category in (''New'', ''Existing''))';
  end if;
end $$;
