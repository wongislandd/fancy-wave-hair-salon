alter table public.services
add column if not exists deleted_at timestamptz;

create index if not exists services_visible_display_order_idx
on public.services (display_order)
where deleted_at is null;
