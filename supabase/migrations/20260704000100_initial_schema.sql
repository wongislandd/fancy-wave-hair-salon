create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.appointment_status as enum ('confirmed', 'cancelled', 'completed');

create table public.salon_settings (
  id boolean primary key default true check (id),
  salon_name text not null default 'Fancy Wave Hair Salon (Flushing)',
  timezone text not null default 'America/New_York',
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes between 5 and 120),
  min_booking_notice_minutes integer not null default 120 check (min_booking_notice_minutes >= 0),
  cancellation_cutoff_minutes integer not null default 60 check (cancellation_cutoff_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_zh text not null default '',
  description_en text not null default '',
  description_zh text not null default '',
  duration_minutes integer not null check (duration_minutes between 15 and 360),
  price_cents integer not null check (price_cents >= 0),
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stylists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  bio text not null default '',
  specialties text[] not null default '{}',
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stylist_services (
  stylist_id uuid not null references public.stylists(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (stylist_id, service_id)
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

create table public.stylist_hours (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stylist_id, day_of_week),
  check (opens_at < closes_at)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  booking_reference text not null unique,
  service_id uuid not null references public.services(id),
  service_name_snapshot text not null,
  service_name_zh_snapshot text not null default '',
  service_duration_minutes_snapshot integer not null,
  service_price_cents_snapshot integer not null,
  stylist_id uuid not null references public.stylists(id),
  stylist_name_snapshot text not null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  notes text,
  internal_notes text,
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
  exclude using gist (stylist_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
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
create trigger stylists_updated_at before update on public.stylists
for each row execute function public.set_updated_at();
create trigger business_hours_updated_at before update on public.business_hours
for each row execute function public.set_updated_at();
create trigger stylist_hours_updated_at before update on public.stylist_hours
for each row execute function public.set_updated_at();
create trigger appointments_updated_at before update on public.appointments
for each row execute function public.set_updated_at();
create trigger staff_profiles_updated_at before update on public.staff_profiles
for each row execute function public.set_updated_at();

alter table public.salon_settings enable row level security;
alter table public.services enable row level security;
alter table public.stylists enable row level security;
alter table public.stylist_services enable row level security;
alter table public.business_hours enable row level security;
alter table public.stylist_hours enable row level security;
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

create policy "Public can view active stylists"
on public.stylists for select
to anon, authenticated
using (
  is_active
  or exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);

create policy "Staff can manage stylists"
on public.stylists for all
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

create policy "Public can view stylist services"
on public.stylist_services for select
to anon, authenticated
using (true);

create policy "Staff can manage stylist services"
on public.stylist_services for all
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

create policy "Public can view stylist hours"
on public.stylist_hours for select
to anon, authenticated
using (
  exists (
    select 1
    from public.stylists
    where stylists.id = stylist_hours.stylist_id
      and (
        stylists.is_active
        or exists (
          select 1 from public.staff_profiles
          where staff_profiles.user_id = (select auth.uid())
        )
      )
  )
);

create policy "Staff can manage stylist hours"
on public.stylist_hours for all
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

create or replace function public.save_stylist_profile(
  p_stylist_id uuid,
  p_name text,
  p_bio text,
  p_specialties text[],
  p_service_ids uuid[],
  p_is_active boolean
)
returns table (stylist_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stylist_id uuid;
  v_display_order integer;
begin
  if not exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  ) then
    raise exception 'Staff access required';
  end if;

  if length(trim(p_name)) < 2 then
    raise exception 'Stylist name is required';
  end if;

  if length(trim(p_bio)) < 10 then
    raise exception 'Stylist bio is required';
  end if;

  if coalesce(array_length(p_service_ids, 1), 0) = 0 then
    raise exception 'Assign at least one service';
  end if;

  if p_stylist_id is null then
    select coalesce(max(display_order), 0) + 1
    into v_display_order
    from public.stylists;

    insert into public.stylists (
      name,
      bio,
      specialties,
      is_active,
      display_order
    )
    values (
      trim(p_name),
      trim(p_bio),
      coalesce(p_specialties, '{}'::text[]),
      p_is_active,
      v_display_order
    )
    returning id into v_stylist_id;
  else
    update public.stylists
    set name = trim(p_name),
        bio = trim(p_bio),
        specialties = coalesce(p_specialties, '{}'::text[]),
        is_active = p_is_active
    where id = p_stylist_id
    returning id into v_stylist_id;

    if not found then
      raise exception 'Stylist not found';
    end if;
  end if;

  delete from public.stylist_services
  where stylist_services.stylist_id = v_stylist_id;

  insert into public.stylist_services (stylist_id, service_id)
  select v_stylist_id, service_id
  from unnest(p_service_ids) as service_id
  on conflict (stylist_id, service_id) do nothing;

  stylist_id := v_stylist_id;
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
  select
    coalesce(stylist_hours.opens_at, business_hours.opens_at),
    coalesce(stylist_hours.closes_at, business_hours.closes_at),
    coalesce(stylist_hours.is_closed, business_hours.is_closed)
  into v_opens_at, v_closes_at, v_is_closed
  from public.business_hours
  left join public.stylist_hours
    on stylist_hours.stylist_id = p_stylist_id
    and stylist_hours.day_of_week = business_hours.day_of_week
  where business_hours.day_of_week = extract(dow from p_date)::integer;

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

create or replace function public.get_booking_by_token(p_token text)
returns table (
  booking_reference text,
  service_id uuid,
  service_name text,
  service_name_zh text,
  service_duration_minutes integer,
  service_price_cents integer,
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

  select
    coalesce(stylist_hours.opens_at, business_hours.opens_at),
    coalesce(stylist_hours.closes_at, business_hours.closes_at),
    coalesce(stylist_hours.is_closed, business_hours.is_closed)
  into v_opens_at, v_closes_at, v_is_closed
  from public.business_hours
  left join public.stylist_hours
    on stylist_hours.stylist_id = v_appointment.stylist_id
    and stylist_hours.day_of_week = business_hours.day_of_week
  where business_hours.day_of_week = extract(dow from v_local_date)::integer;

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

create or replace function public.cancel_booking_by_token(p_token text)
returns table (ok boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
  v_settings public.salon_settings%rowtype;
begin
  select * into v_appointment
  from public.appointments
  where management_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;

  if not found then
    raise exception 'Booking not found';
  end if;
  if v_appointment.status <> 'confirmed' then
    raise exception 'This booking cannot be cancelled';
  end if;

  select * into v_settings from public.salon_settings where id = true;

  if v_appointment.starts_at < now() + make_interval(mins => v_settings.cancellation_cutoff_minutes) then
    raise exception 'This booking can no longer be changed online';
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

grant execute on function public.get_available_slots(uuid, uuid, date) to anon, authenticated;
grant execute on function public.create_appointment(uuid, uuid, timestamptz, text, text, text, text) to anon, authenticated;
grant execute on function public.create_staff_appointment(uuid, uuid, timestamptz, text, text, text, text, text) to authenticated;
grant execute on function public.get_booking_by_token(text) to anon, authenticated;
grant execute on function public.reschedule_booking_by_token(text, timestamptz) to anon, authenticated;
grant execute on function public.cancel_booking_by_token(text) to anon, authenticated;
grant execute on function public.save_stylist_profile(uuid, text, text, text[], uuid[], boolean) to authenticated;

grant select on public.salon_settings to anon, authenticated;
grant select on public.services to anon, authenticated;
grant select on public.stylists to anon, authenticated;
grant select on public.stylist_services to anon, authenticated;
grant select on public.business_hours to anon, authenticated;
grant select on public.stylist_hours to anon, authenticated;
grant select, insert, update, delete on public.services to authenticated;
grant select, insert, update, delete on public.stylists to authenticated;
grant select, insert, update, delete on public.stylist_services to authenticated;
grant select, insert, update, delete on public.business_hours to authenticated;
grant select, insert, update, delete on public.stylist_hours to authenticated;
grant select, insert, update, delete on public.appointments to authenticated;
grant select on public.email_logs to authenticated;
grant select on public.appointment_events to authenticated;
grant select on public.staff_profiles to authenticated;
