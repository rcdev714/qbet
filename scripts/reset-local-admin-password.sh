#!/usr/bin/env bash
# Reset the local admin user's Supabase Auth password (default: E2eAdmin!Test1).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU}"
PASSWORD="${LOCAL_ADMIN_PASSWORD:-E2eAdmin!Test1}"

ADMIN_EMAIL="$(psql "$DB_URL" -tAc "SELECT email FROM public.users WHERE is_admin = true ORDER BY created_at LIMIT 1" | tr -d '[:space:]')"
if [[ -z "$ADMIN_EMAIL" ]]; then
  echo "No admin user found. Sign up locally, then run:"
  echo "  update public.users set is_admin = true where email = 'you@example.com';"
  exit 1
fi

node <<NODE
const { createClient } = require('@supabase/supabase-js');
const admin = createClient('$SUPABASE_URL', '$SERVICE_KEY', {
  auth: { autoRefreshToken: false, persistSession: false },
});
(async () => {
  const { data, error } = await admin.from('users').select('id').eq('is_admin', true).order('created_at').limit(1).maybeSingle();
  if (error || !data?.id) throw new Error(error?.message || 'admin user id not found');
  const { error: updateError } = await admin.auth.admin.updateUserById(data.id, { password: '$PASSWORD' });
  if (updateError) throw updateError;
  console.log('Local admin password reset.');
  console.log('  email:    $ADMIN_EMAIL');
  console.log('  password: $PASSWORD');
  console.log('');
  console.log('Note: npm run test:e2e also resets this password before Playwright runs.');
})();
NODE
