-- Add affected_type to doctor_unavailability so a block can target only
-- Clinic visits OR only Virtual Consult, rather than always blocking both.
-- NULL (the default) keeps the existing all-types behaviour unchanged.

ALTER TABLE public.doctor_unavailability
  ADD COLUMN IF NOT EXISTS affected_type text
    CHECK (affected_type IN ('Clinic', 'Online'));
