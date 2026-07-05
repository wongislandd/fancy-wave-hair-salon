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
security invoker
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
  select v_stylist_id, selected_service.service_id
  from unnest(p_service_ids) as selected_service(service_id)
  on conflict on constraint stylist_services_pkey do nothing;

  stylist_id := v_stylist_id;
  return next;
end;
$$;

revoke execute on function public.save_stylist_profile(uuid, text, text, text[], uuid[], boolean) from public;
revoke execute on function public.save_stylist_profile(uuid, text, text, text[], uuid[], boolean) from anon;
grant execute on function public.save_stylist_profile(uuid, text, text, text[], uuid[], boolean) to authenticated;
