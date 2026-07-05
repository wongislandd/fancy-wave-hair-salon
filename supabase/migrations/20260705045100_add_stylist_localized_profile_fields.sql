alter table public.stylists
add column if not exists bio_en text not null default '',
add column if not exists bio_zh text not null default '',
add column if not exists specialties_en text[] not null default '{}',
add column if not exists specialties_zh text[] not null default '{}';

update public.stylists
set bio_en = case
      when trim(bio_en) = '' then bio
      else bio_en
    end,
    specialties_en = case
      when coalesce(array_length(specialties_en, 1), 0) = 0 then specialties
      else specialties_en
    end;

drop function if exists public.save_stylist_profile(uuid, text, text, text[], uuid[], boolean);

create or replace function public.save_stylist_profile(
  p_stylist_id uuid,
  p_name text,
  p_bio_en text,
  p_bio_zh text,
  p_specialties_en text[],
  p_specialties_zh text[],
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
  v_bio_en text;
  v_bio_zh text;
  v_specialties_en text[];
  v_specialties_zh text[];
  v_legacy_bio text;
  v_legacy_specialties text[];
begin
  if not exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  ) then
    raise exception 'Staff access required';
  end if;

  v_bio_en := trim(coalesce(p_bio_en, ''));
  v_bio_zh := trim(coalesce(p_bio_zh, ''));
  v_specialties_en := coalesce(p_specialties_en, '{}'::text[]);
  v_specialties_zh := coalesce(p_specialties_zh, '{}'::text[]);
  v_legacy_bio := coalesce(nullif(v_bio_en, ''), v_bio_zh);
  v_legacy_specialties := case
    when coalesce(array_length(v_specialties_en, 1), 0) > 0 then v_specialties_en
    else v_specialties_zh
  end;

  if length(trim(p_name)) < 2 then
    raise exception 'Stylist name is required';
  end if;

  if length(v_legacy_bio) < 10 then
    raise exception 'Stylist bio is required';
  end if;

  if coalesce(array_length(v_legacy_specialties, 1), 0) = 0 then
    raise exception 'Add at least one stylist specialty';
  end if;

  if coalesce(array_length(p_service_ids, 1), 0) = 0 then
    raise exception 'Assign at least one service';
  end if;

  if p_stylist_id is null then
    select coalesce(max(display_order), 0) + 1
    into v_display_order
    from public.stylists
    where deleted_at is null;

    insert into public.stylists (
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
    values (
      trim(p_name),
      v_legacy_bio,
      v_bio_en,
      v_bio_zh,
      v_legacy_specialties,
      v_specialties_en,
      v_specialties_zh,
      p_is_active,
      v_display_order
    )
    returning id into v_stylist_id;
  else
    update public.stylists
    set name = trim(p_name),
        bio = v_legacy_bio,
        bio_en = v_bio_en,
        bio_zh = v_bio_zh,
        specialties = v_legacy_specialties,
        specialties_en = v_specialties_en,
        specialties_zh = v_specialties_zh,
        is_active = p_is_active
    where id = p_stylist_id
      and deleted_at is null
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

revoke execute on function public.save_stylist_profile(uuid, text, text, text, text[], text[], uuid[], boolean) from public;
revoke execute on function public.save_stylist_profile(uuid, text, text, text, text[], text[], uuid[], boolean) from anon;
grant execute on function public.save_stylist_profile(uuid, text, text, text, text[], text[], uuid[], boolean) to authenticated;
