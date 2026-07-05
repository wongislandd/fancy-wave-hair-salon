alter table public.email_logs
  add column if not exists sent_at timestamptz,
  add column if not exists last_error text,
  add column if not exists provider_message_id text;

create index if not exists email_logs_pending_delivery_idx
on public.email_logs (kind, created_at desc)
where sent_at is null;
