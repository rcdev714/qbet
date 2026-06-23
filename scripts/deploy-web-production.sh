#!/bin/bash
set -euo pipefail

echo "Starting Expo web production deploy..."

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required but not installed."
  exit 1
fi

if ! npx eas whoami >/dev/null 2>&1; then
  echo "Not logged in to EAS. Run: npx eas login"
  exit 1
fi

echo "Running pre-deploy checks and export with EAS production env..."
# Prevent local .env from inlining 127.0.0.1:54321 into the client bundle.
EXPO_NO_DOTENV=1 npx eas env:exec production "npm run check:web:prod"
bash scripts/check-prod-export-env.sh

echo "Deploying dist/ to Expo production..."
npx eas deploy --prod --environment production --export-dir dist

echo "Web production deploy complete."
