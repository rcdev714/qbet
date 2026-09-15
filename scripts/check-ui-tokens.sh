#!/usr/bin/env bash
# Enforces UI token rules on migrated paths. See docs/ui-system.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENFORCED_FILE="$ROOT/scripts/ui-lint-enforced-paths.txt"
ALLOWLIST_FILE="$ROOT/scripts/ui-lint-allowlist.txt"

fail=0

is_allowlisted() {
  local file="$1"
  local rel="${file#"$ROOT"/}"

  case "$rel" in
    node_modules/*|*.d.ts) return 0 ;;
  esac

  local allowed=(
    "constants/theme.ts"
    "constants/typography.ts"
    "contexts/ThemeContext.tsx"
    "lib/legal/"
    "docs/"
  )
  for prefix in "${allowed[@]}"; do
    if [[ "$rel" == "$prefix"* ]]; then return 0; fi
  done

  if [[ -f "$ALLOWLIST_FILE" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      line="${line%%#*}"
      line="$(echo "$line" | xargs)"
      [[ -z "$line" ]] && continue
      if [[ "$rel" == "$line"* ]]; then return 0; fi
    done < "$ALLOWLIST_FILE"
  fi

  return 1
}

is_enforced() {
  local file="$1"
  local rel="${file#"$ROOT"/}"

  if [[ ! -f "$ENFORCED_FILE" ]]; then return 1; fi

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    line="$(echo "$line" | xargs)"
    [[ -z "$line" ]] && continue
    if [[ "$rel" == "$line" ]]; then return 0; fi
  done < "$ENFORCED_FILE"

  return 1
}

check_file_pattern() {
  local file="$1"
  local pattern="$2"
  local label="$3"

  is_enforced "$file" || return 0
  is_allowlisted "$file" && return 0

  if rg -q "$pattern" "$file" 2>/dev/null; then
    echo "[$label] ${file#"$ROOT"/}"
    fail=1
  fi
}

if [[ ! -f "$ENFORCED_FILE" ]]; then
  echo "Missing $ENFORCED_FILE"
  exit 1
fi

while IFS= read -r rel || [[ -n "$rel" ]]; do
  rel="${rel%%#*}"
  rel="$(echo "$rel" | xargs)"
  [[ -z "$rel" ]] && continue
  file="$ROOT/$rel"
  [[ -f "$file" ]] || continue

  check_file_pattern "$file" '#[0-9A-Fa-f]{3,8}' 'hex-color'
  check_file_pattern "$file" 'fontSize:\s*[0-9]+' 'inline-fontSize'
  check_file_pattern "$file" "fontWeight:\s*['\"]?(500|600|700|bold)" 'inline-fontWeight'
  check_file_pattern "$file" 'borderRadius:\s*[0-9]+' 'inline-borderRadius'
  check_file_pattern "$file" '<Text[\s>]' 'raw-Text'
  check_file_pattern "$file" '<TextInput[\s>]' 'raw-TextInput'
done < "$ENFORCED_FILE"

if [[ "$fail" -ne 0 ]]; then
  echo ""
  echo "UI token violations found in enforced paths. See docs/ui-system.md"
  exit 1
fi

echo "UI token check passed (${ENFORCED_FILE##*/})."
