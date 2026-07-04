# Fancy Wave Hair Salon

A résumé-ready starter project for a two-sided salon booking app. Customers can book as guests and manage their reservation from a magic link. Staff can sign in, review the agenda, cancel appointments, edit services, and update business hours.

## Stack

- Vite + React + TypeScript
- Tailwind CSS
- Supabase Auth, Postgres, RLS, and RPC functions
- TanStack Query, React Hook Form, Zod, date-fns, lucide-react
- Cloudflare Pages deployment target

The app runs in **demo data mode** when Supabase env vars are missing, which is useful while you are capped on Supabase projects. Once a local or hosted Supabase project is available, set the env vars and the same UI will use Supabase.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

Demo staff login when Supabase is not configured:

```text
staff@fancywave.test
demo1234
```

## Supabase Setup

Copy the env template:

```bash
cp .env.example .env
```

For local Supabase:

```bash
supabase start
supabase db reset
```

Then create a staff user in Supabase Studio Auth and add a matching staff profile:

```sql
insert into public.staff_profiles (user_id, display_name, role)
values ('<auth-user-id>', 'Demo Staff', 'manager');
```

Use the local API URL and publishable key in `.env`.

## Database Model

Main tables:

- `services`: editable service catalog with price, duration, and active flag.
- `business_hours`: weekly schedule used for availability.
- `appointments`: guest booking records with service snapshots and token hash.
- `email_logs`: simulated confirmation/reschedule/cancel email records.
- `appointment_events`: audit trail for booking lifecycle actions.
- `staff_profiles`: staff role records tied to `auth.users`.

Public customers do not directly read or update `appointments`. They use token-scoped RPCs:

- `create_appointment`
- `get_available_slots`
- `get_booking_by_token`
- `reschedule_booking_by_token`
- `cancel_booking_by_token`

## Customer Management Links

Confirmation emails/logs include:

```text
/manage-booking/<long-random-token>
```

The raw token is only shown to the customer. The database stores `management_token_hash`, so internal appointment IDs are not used as authorization secrets.

## Cloudflare Pages

Build command:

```bash
npm run build
```

Output directory:

```text
dist
```

Required environment variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

## Verification

```bash
npm test -- --run
npm run build
npm audit --omit=dev
```

At the time this starter was created, production dependencies report zero audit vulnerabilities. `npm audit` still reports dev-only findings through the Vite/Vitest/esbuild toolchain with no direct fix available from npm.

## Stretch Ideas

- Real email delivery with a Supabase Edge Function and Resend.
- Holiday closures and one-off blocked time.
- Customer lookup by booking reference plus email.
- Stylist-specific calendars.
- Revenue and popular-service dashboard cards.
- Stripe deposits.
