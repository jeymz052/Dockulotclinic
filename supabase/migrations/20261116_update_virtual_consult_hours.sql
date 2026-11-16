-- Update virtual consultation schedule:
-- Monday to Friday only, 9:00 AM to 5:00 PM, 30-minute intervals

UPDATE doctor_schedules
SET
  start_time = '09:00:00',
  end_time = '17:00:00',
  slot_minutes = 30,
  is_active = true,
  updated_at = NOW()
WHERE
  schedule_mode = 'Online'
  AND day_of_week IN (1, 2, 3, 4, 5);

UPDATE doctor_schedules
SET
  is_active = false,
  updated_at = NOW()
WHERE
  schedule_mode = 'Online'
  AND day_of_week IN (0, 6);

