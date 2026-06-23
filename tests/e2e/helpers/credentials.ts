import { loadE2eState } from "../state";

/** Local Supabase anon key (demo). Override via SUPABASE_ANON_KEY in CI. */
export const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

/**
 * Admin (app operator): existing local user with users.is_admin = true.
 * Password is reset by run-local-e2e.sh — not the test user's password.
 */
export function adminCredentials() {
  const state = loadE2eState();
  return {
    email: state.adminEmail,
    password: process.env.E2E_ADMIN_PASSWORD ?? "E2eAdmin!Test1",
    storageFile: "admin-storage.json" as const,
  };
}

/**
 * Test user (beta applicant): fresh e2e-*@resend.dev each run from seed-e2e-fixtures.
 * Created via UI signup in user-setup; never is_admin.
 */
export function testUserCredentials() {
  const state = loadE2eState();
  return {
    email: state.testEmail,
    password: state.testPassword,
    storageFile: "user-storage.json" as const,
  };
}
