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
  'Fancy Wave Hair Salon (Flushing)',
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

insert into public.services (
  id,
  name_en,
  name_zh,
  description_en,
  description_zh,
  duration_minutes,
  price_cents,
  price_max_cents,
  price_is_starting_at,
  is_active,
  display_order
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'Signature Haircut',
    '招牌剪发',
    'Wash, precision cut, and a soft finish.',
    '洗发、精剪和柔顺造型。',
    60,
    6500,
    null,
    false,
    true,
    1
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Gloss Treatment',
    '亮泽护理',
    'Tone refresh and shine treatment for luminous color.',
    '补色调理，让发色更亮泽。',
    45,
    8500,
    null,
    false,
    true,
    2
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'Blowout Styling',
    '吹风造型',
    'Smooth, voluminous styling for everyday polish.',
    '柔顺蓬松的日常吹风造型。',
    45,
    5500,
    null,
    false,
    true,
    3
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    'Full Color',
    '全头染发',
    'All-over color consultation, application, and finish.',
    '包含染发咨询、全头上色和造型。',
    120,
    16500,
    null,
    false,
    true,
    4
  )
on conflict (id) do update set
  name_en = excluded.name_en,
  name_zh = excluded.name_zh,
  description_en = excluded.description_en,
  description_zh = excluded.description_zh,
  duration_minutes = excluded.duration_minutes,
  price_cents = excluded.price_cents,
  price_max_cents = excluded.price_max_cents,
  price_is_starting_at = excluded.price_is_starting_at,
  is_active = excluded.is_active,
  display_order = excluded.display_order;

insert into public.stylists (
  id,
  name,
  bio,
  bio_en,
  bio_zh,
  specialties,
  specialties_en,
  specialties_zh,
  is_active,
  display_order
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Nina Park',
    'Precision cuts, soft layers, and lived-in styling.',
    'Precision cuts, soft layers, and lived-in styling.',
    U&'\7CBE\51C6\526A\53D1\3001\67D4\548C\5C42\6B21\548C\81EA\7136\9020\578B\3002',
    array['Cuts', 'Layers', 'Blowouts'],
    array['Cuts', 'Layers', 'Blowouts'],
    array[U&'\526A\53D1', U&'\5C42\6B21', U&'\5439\98CE\9020\578B'],
    true,
    1
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Theo Brooks',
    'Gloss, dimensional color, and healthy shine treatments.',
    'Gloss, dimensional color, and healthy shine treatments.',
    U&'\4E13\6CE8\4EAE\6CFD\3001\7ACB\4F53\67D3\53D1\548C\5065\5EB7\5149\6CFD\62A4\7406\3002',
    array['Gloss', 'Color', 'Treatments'],
    array['Gloss', 'Color', 'Treatments'],
    array[U&'\4EAE\6CFD', U&'\67D3\53D1', U&'\62A4\7406'],
    true,
    2
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'Mara Lee',
    'Full color transformations and polished event styling.',
    'Full color transformations and polished event styling.',
    U&'\64C5\957F\5168\5934\67D3\53D1\8F6C\53D8\548C\7CBE\81F4\6D3B\52A8\9020\578B\3002',
    array['Full Color', 'Styling'],
    array['Full Color', 'Styling'],
    array[U&'\5168\5934\67D3\53D1', U&'\9020\578B'],
    true,
    3
  )
on conflict (id) do update set
  name = excluded.name,
  bio = excluded.bio,
  bio_en = excluded.bio_en,
  bio_zh = excluded.bio_zh,
  specialties = excluded.specialties,
  specialties_en = excluded.specialties_en,
  specialties_zh = excluded.specialties_zh,
  is_active = excluded.is_active,
  display_order = excluded.display_order;

insert into public.stylist_services (stylist_id, service_id)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '44444444-4444-4444-8444-444444444444'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '11111111-1111-4111-8111-111111111111'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '33333333-3333-4333-8333-333333333333'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '44444444-4444-4444-8444-444444444444')
on conflict (stylist_id, service_id) do nothing;

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

insert into public.stylist_hours (stylist_id, day_of_week, opens_at, closes_at, is_closed)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 1, '11:00', '18:00', false),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 6, '09:00', '16:00', true),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 5, '09:00', '15:00', false)
on conflict (stylist_id, day_of_week) do update set
  opens_at = excluded.opens_at,
  closes_at = excluded.closes_at,
  is_closed = excluded.is_closed;

insert into public.appointments (
  id,
  booking_reference,
  service_id,
  service_name_snapshot,
  service_name_zh_snapshot,
  service_duration_minutes_snapshot,
  service_price_cents_snapshot,
  service_price_max_cents_snapshot,
  service_price_is_starting_at_snapshot,
  stylist_id,
  stylist_name_snapshot,
  customer_name,
  customer_email,
  customer_phone,
  notes,
  internal_notes,
  starts_at,
  ends_at,
  status,
  management_token_hash,
  created_at,
  updated_at
)
values
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'FW-DEMO01',
    '11111111-1111-4111-8111-111111111111',
    'Signature Haircut',
    '招牌剪发',
    60,
    6500,
    null,
    false,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Nina Park',
    'Maya Chen',
    'maya@example.com',
    '212-555-0101',
    'First visit. Wants a low-maintenance shape.',
    'Usually asks for soft face-framing layers.',
    '2026-07-06 14:00:00-04',
    '2026-07-06 15:00:00-04',
    'confirmed',
    encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex'),
    now(),
    now()
  ),
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'FW-DEMO00',
    '33333333-3333-4333-8333-333333333333',
    'Blowout Styling',
    '吹风造型',
    45,
    5500,
    null,
    false,
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'Mara Lee',
    'Maya Chen',
    'maya@example.com',
    '212-555-0101',
    'Asked for a bouncy finish with loose waves.',
    'Prefers lower heat around the fringe.',
    '2026-06-19 11:00:00-04',
    '2026-06-19 11:45:00-04',
    'completed',
    encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex'),
    '2026-06-12 10:00:00-04',
    '2026-06-19 12:00:00-04'
  )
on conflict (id) do update set
  booking_reference = excluded.booking_reference,
  service_id = excluded.service_id,
  service_name_snapshot = excluded.service_name_snapshot,
  service_name_zh_snapshot = excluded.service_name_zh_snapshot,
  service_duration_minutes_snapshot = excluded.service_duration_minutes_snapshot,
  service_price_cents_snapshot = excluded.service_price_cents_snapshot,
  service_price_max_cents_snapshot = excluded.service_price_max_cents_snapshot,
  service_price_is_starting_at_snapshot = excluded.service_price_is_starting_at_snapshot,
  stylist_id = excluded.stylist_id,
  stylist_name_snapshot = excluded.stylist_name_snapshot,
  customer_name = excluded.customer_name,
  customer_email = excluded.customer_email,
  customer_phone = excluded.customer_phone,
  notes = excluded.notes,
  internal_notes = excluded.internal_notes,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  status = excluded.status,
  management_token_hash = excluded.management_token_hash,
  updated_at = excluded.updated_at;
