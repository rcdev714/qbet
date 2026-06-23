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

Beta approval emails (Resend + edge function secrets + migrations): see [deploy-beta-approval-notify.md](./deploy-beta-approval-notify.md).

## Automatic web deploy (GitHub → EAS Hosting)

This repo includes [`.eas/workflows/deploy-web-production.yml`](../.eas/workflows/deploy-web-production.yml), which deploys **web only** on push to `master`. It does **not** build or submit iOS/Android.

One-time Expo dashboard setup:

1. Open [Expo project GitHub settings](https://expo.dev/accounts/[account]/projects/[project]/github)
2. Install the GitHub app and connect `rcdev714/qbet`
3. Enable **EAS Workflows** for the linked repo

After linking, every push to `master` runs `type: deploy` with `prod: true` (same as `npm run deploy:web:prod` export + promote).

Native builds remain **manual** only:

```bash
eas build --profile production --platform ios
eas build --profile production --platform android
```

If you previously added dashboard workflows that auto-build iOS/Android on push, remove or disable those in the Expo dashboard — only `deploy-web-production.yml` should trigger on push.

## Rollback

If a deploy is bad, promote the previous deployment alias in Expo dashboard, or redeploy the last known good commit with `npm run deploy:web:prod`.
