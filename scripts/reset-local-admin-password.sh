#!/usr/bin/env bash
# Ensure the local admin auth user exists and reset its password (default: E2eAdmin!Test1).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU}"
PASSWORD="${LOCAL_ADMIN_PASSWORD:-E2eAdmin!Test1}"

read_env_admin_email() {
  if [[ -f "$ROOT/.env" ]]; then
    grep -E '^EXPO_PUBLIC_ADMIN_EMAIL=' "$ROOT/.env" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'"
  fi
}

ADMIN_EMAIL="${LOCAL_ADMIN_EMAIL:-$(read_env_admin_email)}"
ADMIN_EMAIL="$(printf '%s' "$ADMIN_EMAIL" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"

if [[ -z "$ADMIN_EMAIL" ]]; then
  ADMIN_EMAIL="$(psql "$DB_URL" -tAc "SELECT email FROM public.users WHERE is_admin = true ORDER BY created_at LIMIT 1" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
fi

if [[ -z "$ADMIN_EMAIL" ]]; then
  echo "No admin email configured. Set EXPO_PUBLIC_ADMIN_EMAIL in .env or LOCAL_ADMIN_EMAIL=you@example.com"
  exit 1
fi

USER_ID="$(psql "$DB_URL" -tAc "SELECT id FROM auth.users WHERE lower(email) = lower('$ADMIN_EMAIL') LIMIT 1" | tr -d '[:space:]')"

node <<NODE
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = '$SUPABASE_URL';
const serviceKey = '$SERVICE_KEY';
const adminEmail = '$ADMIN_EMAIL';
const password = '$PASSWORD';
const existingUserId = '$USER_ID';

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

(async () => {
  let userId = existingUserId || null;

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
      user_metadata: { username: 'Admin' },
    });
    if (error) throw error;
    userId = data.user?.id ?? null;
    if (!userId) throw new Error('Failed to create local admin auth user');
    console.log('Created local admin auth user.');
  } else {
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updateError) throw updateError;
    console.log('Reset local admin auth password.');
  }

  const { error: profileError } = await admin
    .from('users')
    .upsert(
      {
        id: userId,
        email: adminEmail,
        username: 'Admin',
        is_admin: true,
      },
      { onConflict: 'id' },
    );
  if (profileError) throw profileError;

  console.log('Local admin ready.');
  console.log('  email:    ' + adminEmail);
  console.log('  password: ' + password);
  console.log('');
  console.log('Sign in at http://localhost:8081/login with these credentials.');
})();
NODE
