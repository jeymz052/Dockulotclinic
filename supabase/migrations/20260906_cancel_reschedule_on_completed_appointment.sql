-- Auto-cancel pending reschedule requests when an appointment is Completed, Cancelled, or NoShow

-- 1. Cancel existing pending reschedule requests whose appointment is already Completed, Cancelled, or NoShow
update public.appointment_reschedule_requests arr
set status = 'Cancelled',
    reviewed_at = now(),
    review_note = 'Appointment completed or cancelled'
from public.appointments a
where arr.appointment_id = a.id
  and arr.status = 'Pending'
  and a.status in ('Completed', 'Cancelled', 'NoShow', 'No Show');

-- 2. Trigger to automatically cancel pending reschedule requests whenever an appointment status changes to Completed, Cancelled, or NoShow
create or replace function public.cancel_reschedule_requests_on_appointment_status_change()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status in ('Completed', 'Cancelled', 'NoShow', 'No Show') and (old.status is null or old.status <> new.status) then
    update public.appointment_reschedule_requests
    set status = 'Cancelled',
        reviewed_at = now(),
        review_note = 'Appointment marked as ' || new.status
    where appointment_id = new.id
      and status = 'Pending';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cancel_reschedule_on_appointment_status_change on public.appointments;
create trigger trg_cancel_reschedule_on_appointment_status_change
  after update of status on public.appointments
  for each row
  execute function public.cancel_reschedule_requests_on_appointment_status_change();
