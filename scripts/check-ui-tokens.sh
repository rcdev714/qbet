#!/usr/bin/env bash
# Flags hardcoded hex colors and inline fontSize/fontWeight outside design token files.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ALLOWED=(
  "constants/theme.ts"
  "constants/typography.ts"
  "lib/legal/"
  "docs/"
)

fail=0

check_pattern() {
  local pattern="$1"
  local label="$2"
  while IFS= read -r file; do
    local skip=0
    for allowed in "${ALLOWED[@]}"; do
      if [[ "$file" == *"$allowed"* ]]; then skip=1; break; fi
    done
    if [[ "$skip" -eq 1 ]]; then continue; fi
    if [[ "$file" == *"node_modules"* ]]; then continue; fi
    echo "[$label] $file"
    fail=1
  done < <(rg -l "$pattern" "$ROOT" --glob '*.tsx' --glob '*.ts' 2>/dev/null || true)
}

check_pattern '#[0-9A-Fa-f]{3,8}' 'hex-color'
check_pattern 'fontSize:\s*[0-9]+' 'inline-fontSize'
check_pattern "fontWeight:\s*['\"]?(700|bold)" 'bold-fontWeight'

if [[ "$fail" -ne 0 ]]; then
  echo ""
  echo "UI token violations found. See docs/ui-system.md"
  exit 1
fi

echo "UI token check passed."
