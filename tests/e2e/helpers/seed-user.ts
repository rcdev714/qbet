import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function assertOk(label: string, error: { message?: string; code?: string } | null) {
  if (error) {
    throw new Error(`${label}: ${error.message ?? error.code ?? JSON.stringify(error)}`);
  }
}

/** Bypass Stripe Identity + Checkout UI — mark user live-wallet ready with balance. */
export async function enableLiveWalletForUser(userId: string, groupId: string) {
  const admin = adminClient();

  const { error: userError } = await admin
    .from("users")
    .update({ country_of_residence: "EC" })
    .eq("id", userId);
  await assertOk("users country_of_residence", userError);

  const { error: profileError } = await admin.from("user_compliance_profiles").upsert(
    {
      user_id: userId,
      jurisdiction: "EC",
      age_attested_at: new Date().toISOString(),
      kyc_status: "verified",
      live_wallet_enabled: true,
    },
    { onConflict: "user_id" },
  );
  await assertOk("user_compliance_profiles upsert", profileError);

  const { data: policies } = await admin
    .from("policy_versions")
    .select("id, kind")
    .eq("is_required", true)
    .eq("jurisdiction", "EC")
    .eq("locale", "es")
    .is("retired_at", null);

  const seen = new Set<string>();
  const rows = (policies ?? [])
    .filter((p) => {
      if (seen.has(p.kind)) return false;
      seen.add(p.kind);
      return true;
    })
    .map((p) => ({
      user_id: userId,
      policy_version_id: p.id,
      source: "e2e_ui_setup",
    }));

  if (rows.length > 0) {
    const { error: acceptError } = await admin.from("user_policy_acceptances").upsert(rows, {
      onConflict: "user_id,policy_version_id",
    });
    await assertOk("user_policy_acceptances upsert", acceptError);
  }

  const { error: providerError } = await admin.rpc("upsert_provider_compliance_status", {
    p_user_id: userId,
    p_provider: "stripe_identity",
    p_provider_session_id: `e2e_session_${Date.now()}`,
    p_status: "verified",
    p_provider_customer_id: null,
    p_provider_report_id: null,
    p_provider_event_id: `e2e_evt_${Date.now()}`,
    p_metadata: { e2e: true },
  });
  await assertOk("upsert_provider_compliance_status", providerError);

  const { error: walletError } = await admin.from("wallets").upsert(
    {
      user_id: userId,
      balance: 500,
      currency: "USD",
      is_virtual: false,
      play_balance: 1000,
    },
    { onConflict: "user_id" },
  );
  await assertOk("wallets upsert", walletError);

  const { error: memberError } = await admin.from("group_members").upsert(
    { group_id: groupId, user_id: userId, role: "member" },
    { onConflict: "group_id,user_id" },
  );
  await assertOk("group_members upsert", memberError);
}
