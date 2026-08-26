# Supabase setup

1. Create a Supabase project and copy its Project URL and publishable/anon key into `.env.local` using `.env.example`.
2. Run the SQL files in `supabase/migrations/` in filename order. `0003_scenario_workflow_persistence.sql` is required for persisted scenario invitations.
3. Enable Email auth in Authentication > Providers. Configure the Site URL and redirect URLs for the Vercel domain.
4. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Vercel Preview and Production environments.

`SUPABASE_SERVICE_ROLE_KEY` is reserved for server-only jobs and must never be added to `NEXT_PUBLIC_*` variables or browser code. The app intentionally keeps the current local demo fallback until the public Supabase variables are present.
