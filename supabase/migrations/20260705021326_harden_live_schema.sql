create schema if not exists extensions;

alter extension btree_gist set schema extensions;

alter function public.set_updated_at() set search_path = '';

drop policy if exists "Staff can manage services" on public.services;
drop policy if exists "Staff can manage stylists" on public.stylists;
drop policy if exists "Staff can manage stylist services" on public.stylist_services;
drop policy if exists "Staff can manage business hours" on public.business_hours;
drop policy if exists "Staff can manage stylist hours" on public.stylist_hours;

create policy "Staff can insert services"
on public.services for insert
to authenticated
with check (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);

create policy "Staff can update services"
on public.services for update
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

create policy "Staff can delete services"
on public.services for delete
to authenticated
using (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);

create policy "Staff can insert stylists"
on public.stylists for insert
to authenticated
with check (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);

create policy "Staff can update stylists"
on public.stylists for update
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

create policy "Staff can delete stylists"
on public.stylists for delete
to authenticated
using (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);

create policy "Staff can insert stylist services"
on public.stylist_services for insert
to authenticated
with check (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);

create policy "Staff can update stylist services"
on public.stylist_services for update
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

create policy "Staff can delete stylist services"
on public.stylist_services for delete
to authenticated
using (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);

create policy "Staff can insert business hours"
on public.business_hours for insert
to authenticated
with check (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);

create policy "Staff can update business hours"
on public.business_hours for update
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

create policy "Staff can delete business hours"
on public.business_hours for delete
to authenticated
using (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);

create policy "Staff can insert stylist hours"
on public.stylist_hours for insert
to authenticated
with check (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);

create policy "Staff can update stylist hours"
on public.stylist_hours for update
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

create policy "Staff can delete stylist hours"
on public.stylist_hours for delete
to authenticated
using (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);

create policy "Staff can add email logs"
on public.email_logs for insert
to authenticated
with check (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);

create policy "Staff can add appointment events"
on public.appointment_events for insert
to authenticated
with check (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.user_id = (select auth.uid())
  )
);

grant insert on public.email_logs to authenticated;
grant insert on public.appointment_events to authenticated;

alter function public.save_stylist_profile(uuid, text, text, text[], uuid[], boolean) security invoker;
alter function public.create_staff_appointment(uuid, uuid, timestamptz, text, text, text, text, text) security invoker;

revoke execute on function public.save_stylist_profile(uuid, text, text, text[], uuid[], boolean) from public;
revoke execute on function public.save_stylist_profile(uuid, text, text, text[], uuid[], boolean) from anon;
revoke execute on function public.create_staff_appointment(uuid, uuid, timestamptz, text, text, text, text, text) from public;
revoke execute on function public.create_staff_appointment(uuid, uuid, timestamptz, text, text, text, text, text) from anon;
grant execute on function public.save_stylist_profile(uuid, text, text, text[], uuid[], boolean) to authenticated;
grant execute on function public.create_staff_appointment(uuid, uuid, timestamptz, text, text, text, text, text) to authenticated;
