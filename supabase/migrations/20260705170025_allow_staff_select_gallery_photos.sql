drop policy if exists "Staff can view gallery photos" on public.gallery_photos;

create policy "Staff can view gallery photos"
on public.gallery_photos for select
to authenticated
using (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);
