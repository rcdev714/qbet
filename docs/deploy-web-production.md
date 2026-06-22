# Web production deploy (Expo/EAS)

This project uses Expo Router server web export plus EAS deploy for production web releases.
Server output is required so `https://anymarket.expo.app/share/...` can render per-link Open Graph HTML for social crawlers.

## One-time setup

1. Install dependencies:
   - `npm install`
2. Log in to Expo/EAS:
   - `npx eas login`
3. Confirm project linkage:
   - `npx eas project:info`

## Manual production deploy

Use the single command:

- `npm run deploy:web:prod`

This command does:

1. `npm run typecheck` (`tsc --noEmit`)
2. `npm run lint`
3. `expo export --platform web` (creates `dist/` with server routes)
4. `eas deploy --prod --environment production --export-dir dist`

## Optional direct commands

- `npm run web:export:prod`
- `npm run check:web:prod`
- `npm run web:deploy:prod`

## Required production environment

Set these in the EAS production environment before deploying:

- `EXPO_PUBLIC_APP_URL=https://anymarket.expo.app`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_KEY`
- `EXPO_PUBLIC_ADMIN_EMAIL=admin@example.com` (comma-separated for multiple admins; controls admin UI visibility on web)
- `SUPABASE_SERVICE_ROLE_KEY` (server route only; do not expose this in client code). `SERVICE_ROLE_KEY` is also accepted for local compatibility.

Admin resolve/delete actions also require `users.is_admin = true` in the production Supabase database. Use `supabase/scripts/grant_app_admin.sql` in the SQL Editor if admin UI works but resolve/delete fail.

## Rollback

If a deploy is bad, promote the previous deployment alias in Expo dashboard, or redeploy the last known good commit with `npm run deploy:web:prod`.
