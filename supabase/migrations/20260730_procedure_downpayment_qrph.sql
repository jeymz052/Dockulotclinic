alter table public.online_booking_reservations
  add column if not exists appointment_type text not null default 'Online';

alter table public.online_booking_reservations
  drop constraint if exists online_booking_reservations_appointment_type_check;

alter table public.online_booking_reservations
  add constraint online_booking_reservations_appointment_type_check
  check (appointment_type in ('Clinic', 'Online'));
