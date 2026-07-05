alter table public.email_logs
drop constraint if exists email_logs_kind_check;

alter table public.email_logs
add constraint email_logs_kind_check
check (
  kind in (
    'booking_confirmation',
    'booking_rescheduled',
    'booking_modified',
    'booking_cancelled'
  )
);
