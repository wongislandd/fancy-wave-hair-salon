alter table public.services
  add column if not exists price_max_cents integer,
  add column if not exists price_is_starting_at boolean not null default false;

alter table public.services
  add constraint services_price_max_cents_valid
    check (price_max_cents is null or price_max_cents > price_cents),
  add constraint services_price_open_range_valid
    check (not price_is_starting_at or price_max_cents is null);

alter table public.appointments
  add column if not exists service_price_max_cents_snapshot integer,
  add column if not exists service_price_is_starting_at_snapshot boolean not null default false;

alter table public.appointments
  add constraint appointments_service_price_max_cents_snapshot_valid
    check (
      service_price_max_cents_snapshot is null
      or service_price_max_cents_snapshot > service_price_cents_snapshot
    ),
  add constraint appointments_service_price_open_range_snapshot_valid
    check (
      not service_price_is_starting_at_snapshot
      or service_price_max_cents_snapshot is null
    );

create or replace function public.create_appointment(
  p_service_id uuid,
  p_stylist_id uuid,
  p_starts_at timestamptz,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_notes text default null
)
returns table (
  appointment_id uuid,
  booking_reference text,
  management_token text,
  starts_at timestamptz,
  ends_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service public.services%rowtype;
  v_stylist public.stylists%rowtype;
  v_settings public.salon_settings%rowtype;
  v_opens_at time;
  v_closes_at time;
  v_is_closed boolean;
  v_end_at timestamptz;
  v_token text;
  v_reference text;
  v_appointment_id uuid;
  v_local_date date;
  v_local_start time;
  v_local_end time;
begin
  if length(trim(p_customer_name)) < 2 then
    raise exception 'Customer name is required';
  end if;
  if p_customer_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'A valid customer email is required';
  end if;
  if length(trim(p_customer_phone)) < 7 then
    raise exception 'Customer phone is required';
  end if;

  select * into v_service
  from public.services
  where id = p_service_id and is_active;
  if not found then
    raise exception 'Service is not available';
  end if;

  select * into v_stylist
  from public.stylists
  where id = p_stylist_id and is_active;
  if not found then
    raise exception 'Stylist is not available';
  end if;

  if not exists (
    select 1 from public.stylist_services
    where stylist_id = p_stylist_id and service_id = p_service_id
  ) then
    raise exception 'Stylist does not offer this service';
  end if;

  select * into v_settings from public.salon_settings where id = true;
  v_end_at := p_starts_at + make_interval(mins => v_service.duration_minutes);
  v_local_date := (p_starts_at at time zone v_settings.timezone)::date;
  v_local_start := (p_starts_at at time zone v_settings.timezone)::time;
  v_local_end := (v_end_at at time zone v_settings.timezone)::time;

  select
    coalesce(stylist_hours.opens_at, business_hours.opens_at),
    coalesce(stylist_hours.closes_at, business_hours.closes_at),
    coalesce(stylist_hours.is_closed, business_hours.is_closed)
  into v_opens_at, v_closes_at, v_is_closed
  from public.business_hours
  left join public.stylist_hours
    on stylist_hours.stylist_id = p_stylist_id
    and stylist_hours.day_of_week = business_hours.day_of_week
  where business_hours.day_of_week = extract(dow from v_local_date)::integer;

  if not found or v_is_closed or v_local_start < v_opens_at or v_local_end > v_closes_at then
    raise exception 'Selected time is outside business hours';
  end if;

  if p_starts_at < now() + make_interval(mins => v_settings.min_booking_notice_minutes) then
    raise exception 'Selected time is too soon to book online';
  end if;

  if exists (
    select 1
    from public.appointments existing
    where existing.status = 'confirmed'
      and existing.stylist_id = p_stylist_id
      and tstzrange(existing.starts_at, existing.ends_at, '[)') && tstzrange(p_starts_at, v_end_at, '[)')
  ) then
    raise exception 'Selected time is no longer available';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_reference := 'FW-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));

  insert into public.appointments (
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
    starts_at,
    ends_at,
    management_token_hash
  )
  values (
    v_reference,
    v_service.id,
    v_service.name_en,
    v_service.name_zh,
    v_service.duration_minutes,
    v_service.price_cents,
    v_service.price_max_cents,
    v_service.price_is_starting_at,
    v_stylist.id,
    v_stylist.name,
    trim(p_customer_name),
    lower(trim(p_customer_email)),
    trim(p_customer_phone),
    nullif(trim(coalesce(p_notes, '')), ''),
    p_starts_at,
    v_end_at,
    encode(extensions.digest(v_token, 'sha256'), 'hex')
  )
  returning id into v_appointment_id;

  insert into public.appointment_events (appointment_id, event_type, actor_type)
  values (v_appointment_id, 'booked', 'customer_link');

  insert into public.email_logs (appointment_id, kind, recipient_email, subject, body)
  values (
    v_appointment_id,
    'booking_confirmation',
    lower(trim(p_customer_email)),
    'Your Fancy Wave appointment is confirmed',
    'Your booking reference is ' || v_reference || '. Manage your booking at /manage-booking/' || v_token
  );

  appointment_id := v_appointment_id;
  booking_reference := v_reference;
  management_token := v_token;
  starts_at := p_starts_at;
  ends_at := v_end_at;
  return next;
end;
$$;

create or replace function public.create_staff_appointment(
  p_service_id uuid,
  p_stylist_id uuid,
  p_starts_at timestamptz,
  p_customer_name text,
  p_customer_email text default '',
  p_customer_phone text default '',
  p_notes text default null,
  p_internal_notes text default null
)
returns table (
  appointment_id uuid,
  booking_reference text,
  management_token text,
  starts_at timestamptz,
  ends_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service public.services%rowtype;
  v_stylist public.stylists%rowtype;
  v_settings public.salon_settings%rowtype;
  v_opens_at time;
  v_closes_at time;
  v_is_closed boolean;
  v_end_at timestamptz;
  v_token text;
  v_reference text;
  v_appointment_id uuid;
  v_local_date date;
  v_local_start time;
  v_local_end time;
  v_customer_email text;
  v_customer_phone text;
begin
  if not exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  ) then
    raise exception 'Staff access required';
  end if;

  v_customer_email := lower(trim(coalesce(p_customer_email, '')));
  v_customer_phone := trim(coalesce(p_customer_phone, ''));

  if length(trim(p_customer_name)) < 2 then
    raise exception 'Customer name is required';
  end if;
  if v_customer_email <> '' and v_customer_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'A valid customer email is required';
  end if;
  if v_customer_phone <> '' and length(v_customer_phone) < 7 then
    raise exception 'Customer phone is required';
  end if;

  select * into v_service
  from public.services
  where id = p_service_id and is_active;
  if not found then
    raise exception 'Service is not available';
  end if;

  select * into v_stylist
  from public.stylists
  where id = p_stylist_id and is_active;
  if not found then
    raise exception 'Stylist is not available';
  end if;

  if not exists (
    select 1 from public.stylist_services
    where stylist_id = p_stylist_id and service_id = p_service_id
  ) then
    raise exception 'Stylist does not offer this service';
  end if;

  select * into v_settings from public.salon_settings where id = true;
  v_end_at := p_starts_at + make_interval(mins => v_service.duration_minutes);
  v_local_date := (p_starts_at at time zone v_settings.timezone)::date;
  v_local_start := (p_starts_at at time zone v_settings.timezone)::time;
  v_local_end := (v_end_at at time zone v_settings.timezone)::time;

  select
    coalesce(stylist_hours.opens_at, business_hours.opens_at),
    coalesce(stylist_hours.closes_at, business_hours.closes_at),
    coalesce(stylist_hours.is_closed, business_hours.is_closed)
  into v_opens_at, v_closes_at, v_is_closed
  from public.business_hours
  left join public.stylist_hours
    on stylist_hours.stylist_id = p_stylist_id
    and stylist_hours.day_of_week = business_hours.day_of_week
  where business_hours.day_of_week = extract(dow from v_local_date)::integer;

  if not found or v_is_closed or v_local_start < v_opens_at or v_local_end > v_closes_at then
    raise exception 'Selected time is outside business hours';
  end if;

  if p_starts_at < now() + make_interval(mins => v_settings.min_booking_notice_minutes) then
    raise exception 'Selected time is too soon to book online';
  end if;

  if exists (
    select 1
    from public.appointments existing
    where existing.status = 'confirmed'
      and existing.stylist_id = p_stylist_id
      and tstzrange(existing.starts_at, existing.ends_at, '[)') && tstzrange(p_starts_at, v_end_at, '[)')
  ) then
    raise exception 'Selected time is no longer available';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_reference := 'FW-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));

  insert into public.appointments (
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
    management_token_hash
  )
  values (
    v_reference,
    v_service.id,
    v_service.name_en,
    v_service.name_zh,
    v_service.duration_minutes,
    v_service.price_cents,
    v_service.price_max_cents,
    v_service.price_is_starting_at,
    v_stylist.id,
    v_stylist.name,
    trim(p_customer_name),
    v_customer_email,
    v_customer_phone,
    nullif(trim(coalesce(p_notes, '')), ''),
    nullif(trim(coalesce(p_internal_notes, '')), ''),
    p_starts_at,
    v_end_at,
    encode(extensions.digest(v_token, 'sha256'), 'hex')
  )
  returning id into v_appointment_id;

  insert into public.appointment_events (appointment_id, event_type, actor_type)
  values (v_appointment_id, 'booked', 'staff');

  if v_customer_email <> '' then
    insert into public.email_logs (appointment_id, kind, recipient_email, subject, body)
    values (
      v_appointment_id,
      'booking_confirmation',
      v_customer_email,
      'Your Fancy Wave appointment is confirmed',
      'Your booking reference is ' || v_reference || '. Manage your booking at /manage-booking/' || v_token
    );
  end if;

  appointment_id := v_appointment_id;
  booking_reference := v_reference;
  management_token := v_token;
  starts_at := p_starts_at;
  ends_at := v_end_at;
  return next;
end;
$$;

drop function if exists public.get_booking_by_token(text);

create function public.get_booking_by_token(p_token text)
returns table (
  booking_reference text,
  service_id uuid,
  service_name text,
  service_name_zh text,
  service_duration_minutes integer,
  service_price_cents integer,
  service_price_max_cents integer,
  service_price_is_starting_at boolean,
  customer_name text,
  customer_email text,
  customer_phone text,
  stylist_id uuid,
  stylist_name text,
  notes text,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.appointment_status,
  can_manage_online boolean
)
language sql
security definer
set search_path = ''
as $$
  select
    a.booking_reference,
    a.service_id,
    a.service_name_snapshot,
    a.service_name_zh_snapshot,
    a.service_duration_minutes_snapshot,
    a.service_price_cents_snapshot,
    a.service_price_max_cents_snapshot,
    a.service_price_is_starting_at_snapshot,
    a.customer_name,
    a.customer_email,
    a.customer_phone,
    a.stylist_id,
    a.stylist_name_snapshot,
    a.notes,
    a.starts_at,
    a.ends_at,
    a.status,
    a.status = 'confirmed'
      and a.starts_at >= now() + make_interval(mins => s.cancellation_cutoff_minutes)
  from public.appointments a
  cross join public.salon_settings s
  where a.management_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  limit 1;
$$;

grant execute on function public.create_appointment(uuid, uuid, timestamptz, text, text, text, text) to anon, authenticated;
grant execute on function public.create_staff_appointment(uuid, uuid, timestamptz, text, text, text, text, text) to authenticated;
grant execute on function public.get_booking_by_token(text) to anon, authenticated;
