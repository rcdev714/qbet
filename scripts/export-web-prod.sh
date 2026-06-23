#!/usr/bin/env bash
# Production web export — never inline local Supabase from .env (see deploy-web-production.sh).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

run_export() {
  # --clear avoids reusing a prior local export manifest that inlined 127.0.0.1:54321.
  expo export --platform web --clear "$@"
}

if npx eas whoami >/dev/null 2>&1; then
  EXPO_NO_DOTENV=1 npx eas env:exec production "EXPO_NO_DOTENV=1 npx expo export --platform web --clear"
else
  echo "EAS not logged in — exporting with EXPO_NO_DOTENV and hosted Supabase defaults."
  EXPO_NO_DOTENV=1 \
    EXPO_PUBLIC_SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-https://jweyqlcvvmdyyqgqcsjd.supabase.co}" \
    EXPO_PUBLIC_APP_URL="${EXPO_PUBLIC_APP_URL:-https://anymarket.expo.app}" \
    EXPO_PUBLIC_LAUNCH_JURISDICTION="${EXPO_PUBLIC_LAUNCH_JURISDICTION:-EC}" \
    EXPO_PUBLIC_BETA_REQUIRED="${EXPO_PUBLIC_BETA_REQUIRED:-true}" \
    run_export "$@"
fi

bash scripts/check-prod-export-env.sh
