do $$
begin
  if exists (
    select 1
    from public.payments
    where provider_ref is not null
    group by provider_ref
    having count(*) > 1
  ) then
    raise notice 'Skipping payments_provider_ref_unique because duplicate provider_ref rows already exist. Clean duplicates first, then create the index.';
  else
    create unique index if not exists payments_provider_ref_unique
      on public.payments(provider_ref)
      where provider_ref is not null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from public.online_booking_reservations
    where payment_ref is not null
    group by payment_ref
    having count(*) > 1
  ) then
    raise notice 'Skipping online_booking_reservations_payment_ref_unique because duplicate payment_ref rows already exist. Clean duplicates first, then create the index.';
  else
    create unique index if not exists online_booking_reservations_payment_ref_unique
      on public.online_booking_reservations(payment_ref)
      where payment_ref is not null;
  end if;
end $$;
  