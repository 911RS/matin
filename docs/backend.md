# Backend setup

Steps for a new Supabase project. Requires the Supabase CLI.

1. Create a project in the Supabase dashboard. Note the project ref and the project URL.
2. Link the repo: `supabase link --project-ref <ref>`
3. Set the function secret (any long random string): `supabase secrets set CRON_SECRET=<secret>`
4. In the SQL editor, store the cron settings in the vault. Use the same secret as step 3.

   ```sql
   select vault.create_secret('https://<ref>.supabase.co/functions/v1/daily-suggest', 'daily_suggest_url');
   select vault.create_secret('<secret>', 'cron_secret');
   ```

5. Apply the schema, policies and cron job: `supabase db push`
6. Deploy the functions: `./scripts/deploy-functions.sh` (it first copies the backend and engine sources into `supabase/functions/_vendor`, which is git-ignored)
7. In Authentication > Providers, enable Apple, Google and Email.
8. In Authentication > Email Templates, put `{{ .Token }}` in the body of both the "Confirm signup" template (first-time users, because the app signs in with `shouldCreateUser: true`) and the "Magic Link" template (returning users). The app asks for the 6-digit code, so a template without `{{ .Token }}` sends a user an email with no code.

Notes:

- `daily-suggest` runs every 15 minutes through pg_cron and pg_net, and checks the `CRON_SECRET` bearer token. Both functions accept POST only.
- `delete-account` needs the user's access token and deletes their storage folder and auth user.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to functions by Supabase.
- Type-check the functions with `pnpm check:functions` (also runs the vendor script).
- `daily-suggest` has `verify_jwt = false` in `supabase/config.toml` because pg_cron calls it with `CRON_SECRET`, not a user JWT.
- Local `supabase start` also schedules the cron job. The vault secrets are empty there, so each run logs a failed `net.http_post` with a null URL. This is harmless.
- Push tokens: the app should save its token with `select claim_push_token(<token>)` (RPC `claim_push_token`), which removes the token from any other profile on the same device. On sign-out, clear it with `update profiles set expo_push_token = null` for the signed-in user before ending the session, otherwise the device keeps receiving that user's daily pushes.
