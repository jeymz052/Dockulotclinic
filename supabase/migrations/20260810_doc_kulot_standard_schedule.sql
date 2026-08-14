  -- Standard Doc Kulot schedule:
  -- FamMed Family Clinic: Monday-Friday, 9 AM-4 PM
  -- RT Lim Family Hospital: 1st and 3rd Sundays, 9 AM-4 PM
  -- Virtual consults: daily, 8 AM-8 PM
  -- Booking uses 30-minute consultation slots and one patient per slot.

  alter table public.doctor_schedules
    alter column slot_minutes set default 30;

  do $$
  declare
    doc_id uuid;
    day_value integer;
  begin
    select id into doc_id
    from public.doctors
    where slug = 'doctora-kulot-md'
    limit 1;

    if doc_id is null then
      return;
    end if;

    foreach day_value in array array[0, 1, 2, 3, 4, 5]
    loop
      update public.doctor_schedules
      set
        start_time = '09:00',
        end_time = '16:00',
        slot_minutes = 30,
        schedule_mode = 'Clinic',
        is_active = true,
        updated_at = now()
      where doctor_id = doc_id
        and day_of_week = day_value
        and schedule_mode = 'Clinic';

      if not found then
        insert into public.doctor_schedules (
          doctor_id,
          day_of_week,
          start_time,
          end_time,
          slot_minutes,
          schedule_mode,
          is_active
        )
        values (
          doc_id,
          day_value,
          '09:00',
          '16:00',
          30,
          'Clinic',
          true
        );
      end if;
    end loop;

    foreach day_value in array array[0, 1, 2, 3, 4, 5, 6]
    loop
      update public.doctor_schedules
      set
        start_time = '08:00',
        end_time = '20:00',
        slot_minutes = 30,
        schedule_mode = 'Online',
        is_active = true,
        updated_at = now()
      where doctor_id = doc_id
        and day_of_week = day_value
        and schedule_mode = 'Online';

      if not found then
        insert into public.doctor_schedules (
          doctor_id,
          day_of_week,
          start_time,
          end_time,
          slot_minutes,
          schedule_mode,
          is_active
        )
        values (
          doc_id,
          day_value,
          '08:00',
          '20:00',
          30,
          'Online',
          true
        );
      end if;
    end loop;
  end $$;

  alter table public.system_settings
    alter column max_patients_per_hour set default 1,
    alter column clinic_open_time set default '09:00',
    alter column clinic_close_time set default '16:00';

  update public.system_settings
  set
    max_patients_per_hour = 1,
    clinic_open_time = '09:00',
    clinic_close_time = '16:00',
    updated_at = now()
  where id = true;
