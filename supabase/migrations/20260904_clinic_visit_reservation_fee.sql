-- Seed Clinic Visit Reservation Fee (₱200 non-refundable, deducted at POS)
insert into public.pricing (code, name, category, price)
values
  ('CLINIC-VISIT-RESERVATION', 'Clinic Visit Reservation Fee', 'Consultation', 200)
on conflict (code) do update
set
  name = excluded.name,
  category = excluded.category,
  price = excluded.price;
