-- Update doctor schedules:
-- 1. In-person clinic only at FamMed Family Clinic: Monday to Friday (day_of_week 1..5)
-- 2. Saturday Clinic disabled (day_of_week 6)
-- 3. Sunday totally removed/disabled (day_of_week 0)
-- 4. Virtual Consult: Monday to Saturday (day_of_week 1..6)

UPDATE doctor_schedules
SET is_active = false, updated_at = NOW()
WHERE day_of_week = 0;

UPDATE doctor_schedules
SET is_active = false, updated_at = NOW()
WHERE day_of_week = 6 AND schedule_mode = 'Clinic';

