alter table public.stylists
add column if not exists deleted_at timestamptz;

create index if not exists stylists_visible_display_order_idx
on public.stylists (display_order)
where deleted_at is null;
