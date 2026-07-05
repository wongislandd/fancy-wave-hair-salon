# AGENTS.md

## Default Environment

- Default development target is the staging Supabase project.
- Unless the user asks for local/demo/production specifically, run the app with `npm run dev:staging`.
- Validate staging builds with `npm run build:staging`.
- Use production Supabase only for production deploys, release checks, or explicit user requests.

## Supabase Env Rules

- Frontend code only uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Never commit real Supabase keys, service-role keys, or secret keys.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or other server-only secrets through `VITE_` variables.
- Real env files stay local and ignored: `.env`, `.env.local`, `.env.staging.local`, `.env.production.local`.

## Workflow Notes

- Use `.env.staging.example` as the template for `.env.staging.local`.
- Use `.env.production.example` as the template for `.env.production.local`.
- Vite loads generic `.env` files in addition to mode-specific files, so create `.env.staging.local` before relying on `npm run dev:staging`.
- Demo mode is active when Supabase env vars are missing or the publishable key still contains `your-local-or-hosted`.
