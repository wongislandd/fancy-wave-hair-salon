insert into public.salon_settings (
  id,
  salon_name,
  timezone,
  slot_interval_minutes,
  min_booking_notice_minutes,
  cancellation_cutoff_minutes
)
values (
  true,
  'Fancy Wave Hair Salon',
  'America/New_York',
  30,
  120,
  60
)
on conflict (id) do update set
  salon_name = excluded.salon_name,
  timezone = excluded.timezone,
  slot_interval_minutes = excluded.slot_interval_minutes,
  min_booking_notice_minutes = excluded.min_booking_notice_minutes,
  cancellation_cutoff_minutes = excluded.cancellation_cutoff_minutes;

insert into public.services (id, name, description, duration_minutes, price_cents, is_active, display_order)
values
  ('11111111-1111-4111-8111-111111111111', 'Signature Haircut', 'Wash, precision cut, and a soft finish.', 60, 6500, true, 1),
  ('22222222-2222-4222-8222-222222222222', 'Gloss Treatment', 'Tone refresh and shine treatment for luminous color.', 45, 8500, true, 2),
  ('33333333-3333-4333-8333-333333333333', 'Blowout Styling', 'Smooth, voluminous styling for everyday polish.', 45, 5500, true, 3),
  ('44444444-4444-4444-8444-444444444444', 'Full Color', 'All-over color consultation, application, and finish.', 120, 16500, true, 4)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  duration_minutes = excluded.duration_minutes,
  price_cents = excluded.price_cents,
  is_active = excluded.is_active,
  display_order = excluded.display_order;

insert into public.business_hours (day_of_week, opens_at, closes_at, is_closed)
values
  (0, '10:00', '15:00', true),
  (1, '09:00', '17:00', false),
  (2, '09:00', '17:00', false),
  (3, '09:00', '17:00', false),
  (4, '10:00', '19:00', false),
  (5, '10:00', '19:00', false),
  (6, '09:00', '16:00', false)
on conflict (day_of_week) do update set
  opens_at = excluded.opens_at,
  closes_at = excluded.closes_at,
  is_closed = excluded.is_closed;
