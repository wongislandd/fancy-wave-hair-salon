create or replace function public.reschedule_staff_appointment(
  p_appointment_id uuid,
  p_new_starts_at timestamptz
)
returns table (
  appointment_id uuid,
  booking_reference text,
  recipient_email text,
  starts_at timestamptz,
  ends_at timestamptz
)
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
  if not exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  ) then
    raise exception 'Staff access required';
  end if;

  select * into v_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'Appointment not found';
  end if;

  if v_appointment.status <> 'confirmed' then
    raise exception 'This appointment cannot be moved';
  end if;

  select * into v_settings from public.salon_settings where id = true;

  v_new_end_at := p_new_starts_at + make_interval(mins => v_appointment.service_duration_minutes_snapshot);
  v_local_date := (p_new_starts_at at time zone v_settings.timezone)::date;
  v_local_start := (p_new_starts_at at time zone v_settings.timezone)::time;
  v_local_end := (v_new_end_at at time zone v_settings.timezone)::time;

  execute 'select opens_at, closes_at, is_closed from public.resolve_booking_hours($1, $2)'
  into v_opens_at, v_closes_at, v_is_closed
  using v_appointment.stylist_id, v_local_date;

  if v_opens_at is null
    or v_closes_at is null
    or coalesce(v_is_closed, true)
    or v_local_start < v_opens_at
    or v_local_end > v_closes_at
  then
    raise exception 'Selected time is outside business hours';
  end if;

  if p_new_starts_at < now() + make_interval(mins => v_settings.min_booking_notice_minutes) then
    raise exception 'Selected time is too soon to book';
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
    'staff',
    jsonb_build_object('previous_starts_at', v_appointment.starts_at, 'new_starts_at', p_new_starts_at)
  );

  if trim(coalesce(v_appointment.customer_email, '')) <> '' then
    insert into public.email_logs (appointment_id, kind, recipient_email, subject, body)
    values (
      v_appointment.id,
      'booking_rescheduled',
      v_appointment.customer_email,
      'Your Fancy Wave appointment was moved',
      'Your booking reference ' || v_appointment.booking_reference || ' has been rescheduled by the salon.'
    );
  end if;

  appointment_id := v_appointment.id;
  booking_reference := v_appointment.booking_reference;
  recipient_email := v_appointment.customer_email;
  starts_at := p_new_starts_at;
  ends_at := v_new_end_at;
  return next;
end;
$$;

revoke execute on function public.reschedule_staff_appointment(uuid, timestamptz) from public;
revoke execute on function public.reschedule_staff_appointment(uuid, timestamptz) from anon;
grant execute on function public.reschedule_staff_appointment(uuid, timestamptz) to authenticated;
