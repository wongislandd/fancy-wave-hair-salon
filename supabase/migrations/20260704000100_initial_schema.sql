create extension if not exists pgcrypto;

create type public.appointment_status as enum ('confirmed', 'cancelled', 'completed');

create table public.salon_settings (
  id boolean primary key default true check (id),
  salon_name text not null default 'Fancy Wave Hair Salon',
  timezone text not null default 'America/New_York',
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes between 5 and 120),
  min_booking_notice_minutes integer not null default 120 check (min_booking_notice_minutes >= 0),
  cancellation_cutoff_minutes integer not null default 60 check (cancellation_cutoff_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  duration_minutes integer not null check (duration_minutes between 15 and 360),
  price_cents integer not null check (price_cents >= 0),
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  day_of_week integer not null unique check (day_of_week between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (opens_at < closes_at)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  booking_reference text not null unique,
  service_id uuid not null references public.services(id),
  service_name_snapshot text not null,
  service_duration_minutes_snapshot integer not null,
  service_price_cents_snapshot integer not null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  notes text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'confirmed',
  management_token_hash text not null unique,
  cancelled_at timestamptz,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

create index appointments_starts_at_idx on public.appointments (starts_at);
create index appointments_status_idx on public.appointments (status);
create index appointments_management_token_hash_idx on public.appointments (management_token_hash);

alter table public.appointments
  add constraint no_overlapping_confirmed_appointments
  exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&)
  where (status = 'confirmed');

create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  kind text not null check (kind in ('booking_confirmation', 'booking_rescheduled', 'booking_cancelled')),
  recipient_email text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.appointment_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  event_type text not null check (event_type in ('booked', 'rescheduled', 'cancelled', 'completed')),
  actor_type text not null check (actor_type in ('customer_link', 'staff', 'system')),
  actor_user_id uuid references auth.users(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('staff', 'manager')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger salon_settings_updated_at before update on public.salon_settings
for each row execute function public.set_updated_at();
create trigger services_updated_at before update on public.services
for each row execute function public.set_updated_at();
create trigger business_hours_updated_at before update on public.business_hours
for each row execute function public.set_updated_at();
create trigger appointments_updated_at before update on public.appointments
for each row execute function public.set_updated_at();
create trigger staff_profiles_updated_at before update on public.staff_profiles
for each row execute function public.set_updated_at();

alter table public.salon_settings enable row level security;
alter table public.services enable row level security;
alter table public.business_hours enable row level security;
alter table public.appointments enable row level security;
alter table public.email_logs enable row level security;
alter table public.appointment_events enable row level security;
alter table public.staff_profiles enable row level security;

create policy "Staff can view own profile"
on public.staff_profiles for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Public can view salon settings"
on public.salon_settings for select
to anon, authenticated
using (true);

create policy "Public can view active services"
on public.services for select
to anon, authenticated
using (
  is_active
  or exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);

create policy "Staff can manage services"
on public.services for all
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

create policy "Public can view business hours"
on public.business_hours for select
to anon, authenticated
using (true);

create policy "Staff can manage business hours"
on public.business_hours for all
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

create policy "Staff can manage appointments"
on public.appointments for all
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

create policy "Staff can view email logs"
on public.email_logs for select
to authenticated
using (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);

create policy "Staff can view appointment events"
on public.appointment_events for select
to authenticated
using (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

create or replace function public.get_available_slots(
  p_service_id uuid,
  p_date date
)
returns table (starts_at timestamptz, ends_at timestamptz, label text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service public.services%rowtype;
  v_settings public.salon_settings%rowtype;
  v_hours public.business_hours%rowtype;
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

  select * into v_settings from public.salon_settings where id = true;
  select * into v_hours
  from public.business_hours
  where day_of_week = extract(dow from p_date)::integer;

  if not found or v_hours.is_closed then
    return;
  end if;

  v_open_at := ((p_date::text || ' ' || v_hours.opens_at::text)::timestamp at time zone v_settings.timezone);
  v_close_at := ((p_date::text || ' ' || v_hours.closes_at::text)::timestamp at time zone v_settings.timezone);
  v_candidate := v_open_at;

  while v_candidate + make_interval(mins => v_service.duration_minutes) <= v_close_at loop
    v_end_at := v_candidate + make_interval(mins => v_service.duration_minutes);

    if v_candidate >= now() + make_interval(mins => v_settings.min_booking_notice_minutes)
      and not exists (
        select 1
        from public.appointments existing
        where existing.status = 'confirmed'
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
  v_settings public.salon_settings%rowtype;
  v_hours public.business_hours%rowtype;
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

  select * into v_settings from public.salon_settings where id = true;
  v_end_at := p_starts_at + make_interval(mins => v_service.duration_minutes);
  v_local_date := (p_starts_at at time zone v_settings.timezone)::date;
  v_local_start := (p_starts_at at time zone v_settings.timezone)::time;
  v_local_end := (v_end_at at time zone v_settings.timezone)::time;

  select * into v_hours
  from public.business_hours
  where day_of_week = extract(dow from v_local_date)::integer;

  if not found or v_hours.is_closed or v_local_start < v_hours.opens_at or v_local_end > v_hours.closes_at then
    raise exception 'Selected time is outside business hours';
  end if;

  if p_starts_at < now() + make_interval(mins => v_settings.min_booking_notice_minutes) then
    raise exception 'Selected time is too soon to book online';
  end if;

  if exists (
    select 1
    from public.appointments existing
    where existing.status = 'confirmed'
      and tstzrange(existing.starts_at, existing.ends_at, '[)') && tstzrange(p_starts_at, v_end_at, '[)')
  ) then
    raise exception 'Selected time is no longer available';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_reference := 'FW-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));

  insert into public.appointments (
    booking_reference,
    service_id,
    service_name_snapshot,
    service_duration_minutes_snapshot,
    service_price_cents_snapshot,
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
    v_service.name,
    v_service.duration_minutes,
    v_service.price_cents,
    trim(p_customer_name),
    lower(trim(p_customer_email)),
    trim(p_customer_phone),
    nullif(trim(coalesce(p_notes, '')), ''),
    p_starts_at,
    v_end_at,
    encode(digest(v_token, 'sha256'), 'hex')
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

create or replace function public.get_booking_by_token(p_token text)
returns table (
  booking_reference text,
  service_id uuid,
  service_name text,
  service_duration_minutes integer,
  service_price_cents integer,
  customer_name text,
  customer_email text,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.appointment_status
)
language sql
security definer
set search_path = ''
as $$
  select
    a.booking_reference,
    a.service_id,
    a.service_name_snapshot,
    a.service_duration_minutes_snapshot,
    a.service_price_cents_snapshot,
    a.customer_name,
    a.customer_email,
    a.starts_at,
    a.ends_at,
    a.status
  from public.appointments a
  where a.management_token_hash = encode(digest(p_token, 'sha256'), 'hex')
  limit 1;
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
  v_hours public.business_hours%rowtype;
  v_new_end_at timestamptz;
  v_local_date date;
  v_local_start time;
  v_local_end time;
begin
  select * into v_appointment
  from public.appointments
  where management_token_hash = encode(digest(p_token, 'sha256'), 'hex')
  for update;

  if not found then
    raise exception 'Booking not found';
  end if;
  if v_appointment.status <> 'confirmed' then
    raise exception 'This booking cannot be rescheduled';
  end if;

  select * into v_settings from public.salon_settings where id = true;
  v_new_end_at := p_new_starts_at + make_interval(mins => v_appointment.service_duration_minutes_snapshot);
  v_local_date := (p_new_starts_at at time zone v_settings.timezone)::date;
  v_local_start := (p_new_starts_at at time zone v_settings.timezone)::time;
  v_local_end := (v_new_end_at at time zone v_settings.timezone)::time;

  select * into v_hours
  from public.business_hours
  where day_of_week = extract(dow from v_local_date)::integer;

  if not found or v_hours.is_closed or v_local_start < v_hours.opens_at or v_local_end > v_hours.closes_at then
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

create or replace function public.cancel_booking_by_token(p_token text)
returns table (ok boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
begin
  select * into v_appointment
  from public.appointments
  where management_token_hash = encode(digest(p_token, 'sha256'), 'hex')
  for update;

  if not found then
    raise exception 'Booking not found';
  end if;
  if v_appointment.status <> 'confirmed' then
    raise exception 'This booking cannot be cancelled';
  end if;

  update public.appointments
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_reason = 'Cancelled by customer link'
  where id = v_appointment.id;

  insert into public.appointment_events (appointment_id, event_type, actor_type)
  values (v_appointment.id, 'cancelled', 'customer_link');

  insert into public.email_logs (appointment_id, kind, recipient_email, subject, body)
  values (
    v_appointment.id,
    'booking_cancelled',
    v_appointment.customer_email,
    'Your Fancy Wave appointment was cancelled',
    'Your booking reference ' || v_appointment.booking_reference || ' has been cancelled.'
  );

  ok := true;
  return next;
end;
$$;

grant execute on function public.get_available_slots(uuid, date) to anon, authenticated;
grant execute on function public.create_appointment(uuid, timestamptz, text, text, text, text) to anon, authenticated;
grant execute on function public.get_booking_by_token(text) to anon, authenticated;
grant execute on function public.reschedule_booking_by_token(text, timestamptz) to anon, authenticated;
grant execute on function public.cancel_booking_by_token(text) to anon, authenticated;

grant select on public.salon_settings to anon, authenticated;
grant select on public.services to anon, authenticated;
grant select on public.business_hours to anon, authenticated;
grant select, insert, update, delete on public.services to authenticated;
grant select, insert, update, delete on public.business_hours to authenticated;
grant select, insert, update, delete on public.appointments to authenticated;
grant select on public.email_logs to authenticated;
grant select on public.appointment_events to authenticated;
grant select on public.staff_profiles to authenticated;
