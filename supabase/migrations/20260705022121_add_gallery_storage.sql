create table public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique check (length(trim(storage_path)) > 0),
  alt_text text not null check (length(trim(alt_text)) >= 3),
  caption text check (caption is null or length(caption) <= 160),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index gallery_photos_active_order_idx
on public.gallery_photos (is_active, display_order);

create trigger gallery_photos_updated_at before update on public.gallery_photos
for each row execute function public.set_updated_at();

alter table public.gallery_photos enable row level security;

create policy "Public can view active gallery photos"
on public.gallery_photos for select
to anon, authenticated
using (is_active);

create policy "Staff can manage gallery photos"
on public.gallery_photos for all
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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gallery-photos',
  'gallery-photos',
  true,
  5242880,
  array['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Staff can read gallery photo objects"
on storage.objects for select
to authenticated
using (
  bucket_id = 'gallery-photos'
  and exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);

create policy "Staff can upload gallery photo objects"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'gallery-photos'
  and (storage.foldername(name))[1] = 'gallery'
  and exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);

create policy "Staff can update gallery photo objects"
on storage.objects for update
to authenticated
using (
  bucket_id = 'gallery-photos'
  and exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'gallery-photos'
  and (storage.foldername(name))[1] = 'gallery'
  and exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);

create policy "Staff can delete gallery photo objects"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'gallery-photos'
  and exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);

grant select on public.gallery_photos to anon, authenticated;
grant insert, update, delete on public.gallery_photos to authenticated;
