/**
 * Prepare deterministic E2E state for local full-stack tests.
 * Run: npx tsx scripts/seed-e2e-fixtures.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import { enableLiveWalletForUser } from "../tests/e2e/helpers/seed-user";

const ROOT = path.resolve(__dirname, "..");
const RUNTIME_DIR = path.join(ROOT, "tests/e2e/.runtime");
const STATE_FILE = path.join(RUNTIME_DIR, "e2e-state.json");

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const GROUP_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22";
const MARKET_ID = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33";
const YES_OPTION_ID = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d44";
const NO_OPTION_ID = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e55";

export type E2eState = {
  testEmail: string;
  testPassword: string;
  timestamp: number;
  adminEmail: string;
  groupId: string;
  marketId: string;
  yesOptionId: string;
  noOptionId: string;
  shareCode: string;
  userId?: string;
};

function randomPassword() {
  return `E2eTest!${Date.now().toString(36)}A1`;
}

async function assertOk(label: string, error: { message?: string; code?: string; details?: string } | null) {
  if (error) {
    throw new Error(`${label}: ${error.message ?? error.code ?? JSON.stringify(error)}`);
  }
}

async function ensureSeedMarket(admin: ReturnType<typeof createClient<any>>) {
  const { data: adminRow } = await admin
    .from("users")
    .select("id")
    .eq("is_admin", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const adminId = adminRow?.id;
  if (!adminId) throw new Error("No admin user — create one locally first");

  const { error: groupError } = await admin.from("groups").upsert(
    {
      id: GROUP_ID,
      name: "E2E Test Group",
      share_code: "E2ETEST",
      description: "Local E2E private group",
      admin_id: adminId,
    },
    { onConflict: "id" },
  );
  assertOk("groups upsert", groupError);

  const { error: memberError } = await admin.from("group_members").upsert(
    { group_id: GROUP_ID, user_id: adminId, role: "admin" },
    { onConflict: "group_id,user_id" },
  );
  assertOk("group_members upsert", memberError);

  const { error: marketError } = await admin.from("markets").upsert(
    {
      id: MARKET_ID,
      group_id: GROUP_ID,
      creator_id: adminId,
      question: "Will E2E test pass today?",
      description: "Automated local E2E market",
      status: "open" as const,
      closes_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      is_public: false,
    },
    { onConflict: "id" },
  );
  assertOk("markets upsert", marketError);

  const { error: resetError } = await admin
    .from("markets")
    .update({
      status: "open",
      winning_option_id: null,
      resolved_at: null,
      compliance_review_state: "approved",
      public_feed_allowed: false,
      market_category: "general_event",
      sensitivity_tier: "standard",
    })
    .eq("id", MARKET_ID);
  assertOk("markets reset", resetError);

  const { error: optionsError } = await admin.from("options").upsert(
    [
      { id: YES_OPTION_ID, market_id: MARKET_ID, label: "Yes", total_pool: 0 },
      { id: NO_OPTION_ID, market_id: MARKET_ID, label: "No", total_pool: 0 },
    ],
    { onConflict: "id" },
  );
  assertOk("options upsert", optionsError);

  const { error: reviewError } = await admin.from("market_compliance_reviews").upsert(
    {
      market_id: MARKET_ID,
      creator_id: adminId,
      category: "general_event",
      sensitivity_tier: "standard",
      review_state: "approved",
      public_feed_allowed: false,
      resolution_source: "E2E seed market",
      resolver_type: "creator_source",
      creator_attestation: true,
      reason_code: "e2e_seed",
      metadata: { source: "seed-e2e-fixtures" },
    },
    { onConflict: "market_id" },
  );
  assertOk("market_compliance_reviews upsert", reviewError);

  return adminId;
}

async function main() {
  const admin = createClient<any>(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const timestamp = Date.now();
  const testEmail = process.env.E2E_TEST_EMAIL ?? `e2e-${timestamp}@resend.dev`;
  const testPassword = process.env.E2E_TEST_PASSWORD ?? randomPassword();
  const apiSetup = process.env.E2E_API_SETUP === "1";

  const { data: adminUser } = await admin
    .from("users")
    .select("email")
    .eq("is_admin", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!adminUser?.email) {
    throw new Error("No admin user in database");
  }

  await ensureSeedMarket(admin);

  const state: E2eState = {
    testEmail,
    testPassword,
    timestamp,
    adminEmail: adminUser.email,
    groupId: GROUP_ID,
    marketId: MARKET_ID,
    yesOptionId: YES_OPTION_ID,
    noOptionId: NO_OPTION_ID,
    shareCode: "E2ETEST",
  };

  if (apiSetup) {
    await admin.from("beta_invites").upsert(
      { email: testEmail.toLowerCase() },
      { onConflict: "email" },
    );

    const createResult = await admin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { username: `E2EUser_${timestamp}` },
    });
    const created = createResult.data;
    const createError = createResult.error;

    if (createError && !created?.user?.id) {
      const err = createError as {
        message?: string;
        code?: string;
        status?: number;
        name?: string;
      };
      throw new Error(
        `createUser(${testEmail}): ${err.message || err.code || String(err.status) || err.name || "unknown auth error"}`,
      );
    }
    if (!created?.user?.id) {
      throw new Error(`createUser(${testEmail}): no user returned`);
    }

    state.userId = created.user.id;
    await enableLiveWalletForUser(created.user.id, GROUP_ID);
  }

  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  console.log("E2E state written to", STATE_FILE);
  console.log("  testEmail:", testEmail);
  console.log("  adminEmail:", adminUser.email);
  console.log("  groupId:", GROUP_ID);
  if (apiSetup) console.log("  userId:", state.userId, "(E2E_API_SETUP=1)");
}

main().catch((err) => {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: unknown }).message)
        : JSON.stringify(err);
  console.error("seed-e2e-fixtures failed:", message);
  process.exit(1);
});
