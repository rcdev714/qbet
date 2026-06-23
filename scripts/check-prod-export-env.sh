#!/usr/bin/env bash
# Fail if a web export bundles local Supabase instead of production.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DIST_GLOB="dist/client/_expo/static/js/web/entry-*.js"
shopt -s nullglob
BUNDLES=(dist/client/_expo/static/js/web/entry-*.js)
shopt -u nullglob

if [[ ${#BUNDLES[@]} -eq 0 ]]; then
  echo "No web entry bundle found at $DIST_GLOB — run expo export first."
  exit 1
fi

for bundle in "${BUNDLES[@]}"; do
  if rg -q '127\.0\.0\.1:54321|localhost:54321' "$bundle"; then
    echo "Production export check failed: $bundle contains a local Supabase URL."
    echo "Re-export with: EXPO_NO_DOTENV=1 npx eas env:exec production \"npm run web:export:prod\""
    exit 1
  fi
  if ! rg -q 'jweyqlcvvmdyyqgqcsjd\.supabase\.co' "$bundle"; then
    echo "Production export check failed: $bundle is missing hosted Supabase URL."
    exit 1
  fi
done

echo "Production export env check passed (${#BUNDLES[@]} bundle(s))."
