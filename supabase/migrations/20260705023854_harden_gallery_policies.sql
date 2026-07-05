drop policy if exists "Staff can manage gallery photos" on public.gallery_photos;

create policy "Staff can insert gallery photos"
on public.gallery_photos for insert
to authenticated
with check (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);

create policy "Staff can update gallery photos"
on public.gallery_photos for update
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

create policy "Staff can delete gallery photos"
on public.gallery_photos for delete
to authenticated
using (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);
