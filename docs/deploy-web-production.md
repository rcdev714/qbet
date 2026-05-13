# Web production deploy (Expo/EAS)

This project uses Expo Router static web export plus EAS deploy for production web releases.

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

1. `expo export --platform web` (creates `dist/`)
2. `eas deploy --prod --environment production --export-dir dist`

## Optional direct commands

- `npm run web:export:prod`
- `npm run web:deploy:prod`

## Rollback

If a deploy is bad, promote the previous deployment alias in Expo dashboard, or redeploy the last known good commit with `npm run deploy:web:prod`.
