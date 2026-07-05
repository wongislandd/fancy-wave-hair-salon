create table if not exists public.business_hour_exceptions (
  id uuid primary key default gen_random_uuid(),
  starts_on date not null,
  ends_on date not null,
  opens_at time not null default '09:00',
  closes_at time not null default '17:00',
  is_closed boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (opens_at < closes_at)
);

create index if not exists business_hour_exceptions_date_range_idx
on public.business_hour_exceptions (starts_on, ends_on);

create trigger business_hour_exceptions_updated_at
before update on public.business_hour_exceptions
for each row execute function public.set_updated_at();

alter table public.business_hour_exceptions enable row level security;

create policy "Public can view business hour exceptions"
on public.business_hour_exceptions for select
to anon, authenticated
using (true);

create policy "Staff can insert business hour exceptions"
on public.business_hour_exceptions for insert
to authenticated
with check (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);

create policy "Staff can update business hour exceptions"
on public.business_hour_exceptions for update
to authenticated
using (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);

create policy "Staff can delete business hour exceptions"
on public.business_hour_exceptions for delete
to authenticated
using (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);

grant select on public.business_hour_exceptions to anon, authenticated;
grant select, insert, update, delete on public.business_hour_exceptions to authenticated;

create or replace function public.resolve_booking_hours(
  p_stylist_id uuid,
  p_date date
)
returns table (opens_at time, closes_at time, is_closed boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_business public.business_hours%rowtype;
  v_exception public.business_hour_exceptions%rowtype;
  v_stylist public.stylist_hours%rowtype;
  v_store_opens_at time;
  v_store_closes_at time;
  v_store_is_closed boolean;
begin
  select * into v_business
  from public.business_hours
  where day_of_week = extract(dow from p_date)::integer;

  if not found then
    return;
  end if;

  select * into v_exception
  from public.business_hour_exceptions
  where p_date between starts_on and ends_on
  order by starts_on desc, created_at desc, id desc
  limit 1;

  if found then
    v_store_opens_at := v_exception.opens_at;
    v_store_closes_at := v_exception.closes_at;
    v_store_is_closed := v_exception.is_closed;
  else
    v_store_opens_at := v_business.opens_at;
    v_store_closes_at := v_business.closes_at;
    v_store_is_closed := v_business.is_closed;
  end if;

  select * into v_stylist
  from public.stylist_hours
  where stylist_id = p_stylist_id
    and day_of_week = extract(dow from p_date)::integer;

  if found then
    opens_at := greatest(v_store_opens_at, v_stylist.opens_at);
    closes_at := least(v_store_closes_at, v_stylist.closes_at);
    is_closed := v_store_is_closed
      or v_stylist.is_closed
      or opens_at >= closes_at;
  else
    opens_at := v_store_opens_at;
    closes_at := v_store_closes_at;
    is_closed := v_store_is_closed;
  end if;

  return next;
end;
$$;

create or replace function public.get_available_slots(
  p_service_id uuid,
  p_stylist_id uuid,
  p_date date
)
returns table (starts_at timestamptz, ends_at timestamptz, label text)
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
  v_open_at timestamptz;
  v_close_at timestamptz;
  v_candidate timestamptz;
  v_end_at timestamptz;
begin
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
  select booking_hours.opens_at, booking_hours.closes_at, booking_hours.is_closed
  into v_opens_at, v_closes_at, v_is_closed
  from public.resolve_booking_hours(p_stylist_id, p_date) as booking_hours;

  if not found or v_is_closed then
    return;
  end if;

  v_open_at := ((p_date::text || ' ' || v_opens_at::text)::timestamp at time zone v_settings.timezone);
  v_close_at := ((p_date::text || ' ' || v_closes_at::text)::timestamp at time zone v_settings.timezone);
  v_candidate := v_open_at;

  while v_candidate + make_interval(mins => v_service.duration_minutes) <= v_close_at loop
    v_end_at := v_candidate + make_interval(mins => v_service.duration_minutes);

    if v_candidate >= now() + make_interval(mins => v_settings.min_booking_notice_minutes)
      and not exists (
        select 1
        from public.appointments existing
        where existing.status = 'confirmed'
          and existing.stylist_id = p_stylist_id
          and tstzrange(existing.starts_at, existing.ends_at, '[)') && tstzrange(v_candidate, v_end_at, '[)')
      )
    then
      starts_at := v_candidate;
      ends_at := v_end_at;
      label := to_char(v_candidate at time zone v_settings.timezone, 'FMHH12:MI AM');
      return next;
    end if;

    v_candidate := v_candidate + make_interval(mins => v_settings.slot_interval_minutes);
  end loop;
end;
$$;

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

  select booking_hours.opens_at, booking_hours.closes_at, booking_hours.is_closed
  into v_opens_at, v_closes_at, v_is_closed
  from public.resolve_booking_hours(p_stylist_id, v_local_date) as booking_hours;

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
security invoker
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

  select booking_hours.opens_at, booking_hours.closes_at, booking_hours.is_closed
  into v_opens_at, v_closes_at, v_is_closed
  from public.resolve_booking_hours(p_stylist_id, v_local_date) as booking_hours;

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

create or replace function public.reschedule_booking_by_token(
  p_token text,
  p_new_starts_at timestamptz
)
returns table (ok boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
  v_settings public.salon_settings%rowtype;
  v_opens_at time;
  v_closes_at time;
  v_is_closed boolean;
  v_new_end_at timestamptz;
  v_local_date date;
  v_local_start time;
  v_local_end time;
begin
  select * into v_appointment
  from public.appointments
  where management_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;

  if not found then
    raise exception 'Booking not found';
  end if;
  if v_appointment.status <> 'confirmed' then
    raise exception 'This booking cannot be rescheduled';
  end if;

  select * into v_settings from public.salon_settings where id = true;

  if v_appointment.starts_at < now() + make_interval(mins => v_settings.cancellation_cutoff_minutes) then
    raise exception 'This booking can no longer be changed online';
  end if;

  v_new_end_at := p_new_starts_at + make_interval(mins => v_appointment.service_duration_minutes_snapshot);
  v_local_date := (p_new_starts_at at time zone v_settings.timezone)::date;
  v_local_start := (p_new_starts_at at time zone v_settings.timezone)::time;
  v_local_end := (v_new_end_at at time zone v_settings.timezone)::time;

  select booking_hours.opens_at, booking_hours.closes_at, booking_hours.is_closed
  into v_opens_at, v_closes_at, v_is_closed
  from public.resolve_booking_hours(v_appointment.stylist_id, v_local_date) as booking_hours;

  if not found or v_is_closed or v_local_start < v_opens_at or v_local_end > v_closes_at then
    raise exception 'Selected time is outside business hours';
  end if;

  if p_new_starts_at < now() + make_interval(mins => v_settings.min_booking_notice_minutes) then
    raise exception 'Selected time is too soon to book online';
  end if;

  if exists (
    select 1
    from public.appointments existing
    where existing.id <> v_appointment.id
      and existing.status = 'confirmed'
      and existing.stylist_id = v_appointment.stylist_id
      and tstzrange(existing.starts_at, existing.ends_at, '[)') && tstzrange(p_new_starts_at, v_new_end_at, '[)')
  ) then
    raise exception 'Selected time is no longer available';
  end if;

  update public.appointments
  set starts_at = p_new_starts_at,
      ends_at = v_new_end_at
  where id = v_appointment.id;

  insert into public.appointment_events (appointment_id, event_type, actor_type, metadata)
  values (
    v_appointment.id,
    'rescheduled',
    'customer_link',
    jsonb_build_object('previous_starts_at', v_appointment.starts_at, 'new_starts_at', p_new_starts_at)
  );

  insert into public.email_logs (appointment_id, kind, recipient_email, subject, body)
  values (
    v_appointment.id,
    'booking_rescheduled',
    v_appointment.customer_email,
    'Your Fancy Wave appointment was moved',
    'Your booking reference ' || v_appointment.booking_reference || ' has been rescheduled.'
  );

  ok := true;
  return next;
end;
$$;

grant execute on function public.get_available_slots(uuid, uuid, date) to anon, authenticated;
grant execute on function public.create_appointment(uuid, uuid, timestamptz, text, text, text, text) to anon, authenticated;
revoke execute on function public.create_staff_appointment(uuid, uuid, timestamptz, text, text, text, text, text) from public;
revoke execute on function public.create_staff_appointment(uuid, uuid, timestamptz, text, text, text, text, text) from anon;
grant execute on function public.create_staff_appointment(uuid, uuid, timestamptz, text, text, text, text, text) to authenticated;
grant execute on function public.reschedule_booking_by_token(text, timestamptz) to anon, authenticated;
