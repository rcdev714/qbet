import { createClient } from "@supabase/supabase-js";
import { loadE2eState } from "../state";
import { SUPABASE_ANON_KEY } from "./credentials";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export async function addUserToGroup(userId: string, groupId: string) {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await admin.from("group_members").upsert(
    { group_id: groupId, user_id: userId, role: "member" },
    { onConflict: "group_id,user_id" },
  );
}

export async function resolveMarketAsAdmin(marketId: string, winningOptionId: string) {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const state = loadE2eState();
  const { data: linkData } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: state.adminEmail,
  });
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let token: string | undefined;
  if (linkData.properties?.email_otp) {
    const { data } = await anon.auth.verifyOtp({
      email: state.adminEmail,
      token: linkData.properties.email_otp,
      type: "magiclink",
    });
    token = data.session?.access_token;
  }
  if (!token) throw new Error("Admin token for resolve failed");

  const resolver = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await resolver.rpc("resolve_market", {
    p_market_id: marketId,
    p_winning_option_id: winningOptionId,
    p_evidence_url: null,
    p_evidence_notes: "E2E automated resolution",
  });
  if (error) throw error;

  const { error: dispatchError } = await resolver.functions.invoke(
    "dispatch-market-contract-emails",
    { body: { marketId } },
  );
  if (dispatchError) throw dispatchError;
}

export async function assertPostConditions() {
  const state = loadE2eState();
  if (!state.userId || !state.lastBetId) {
    console.log("[assert-db] Skipping — full UI flow did not record userId/betId");
    return;
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile } = await admin
    .from("user_compliance_profiles")
    .select("kyc_status, live_wallet_enabled")
    .eq("user_id", state.userId)
    .maybeSingle();

  if (profile?.kyc_status !== "verified") {
    console.warn("[assert-db] kyc_status not verified — Stripe Identity may still be processing");
  }

  const { data: wallet } = await admin
    .from("wallets")
    .select("balance")
    .eq("user_id", state.userId)
    .maybeSingle();

  if ((wallet?.balance ?? 0) <= 0) {
    console.warn("[assert-db] wallet balance still 0 — deposit webhook may not have fired");
  }

  const { data: contract } = await admin
    .from("bet_contracts")
    .select("id, resolved_snapshot, placed_email_sent_at, resolved_email_sent_at")
    .eq("bet_id", state.lastBetId)
    .maybeSingle();

  if (!contract) {
    throw new Error(`No bet_contracts row for bet ${state.lastBetId}`);
  }
  if (!contract.resolved_snapshot) {
    console.warn("[assert-db] resolved_snapshot missing — market may not be resolved yet");
  }
}

export async function getUserIdByEmail(email: string): Promise<string | null> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data } = await admin.from("users").select("id").eq("email", email).maybeSingle();
  return data?.id ?? null;
}
