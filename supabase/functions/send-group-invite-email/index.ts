// @ts-nocheck: Deno edge runtime (Supabase).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { createEdgeLogger } from "../_shared/edge-logger.ts";
import { sendViaResend } from "../_shared/email/resend-client.ts";
import { buildGroupInviteEmail } from "../_shared/email/templates/group-invite.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, idempotency-key",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  const log = createEdgeLogger("send-group-invite-email");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "Anymarkt <onboarding@anymarkt.com>";
    const appUrl = Deno.env.get("EXPO_PUBLIC_APP_URL") ?? "http://localhost:8081";

    if (!resendApiKey) {
      return json({ error: "RESEND_API_KEY is not configured" }, 500);
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const groupId = body?.groupId as string | undefined;
    const email = (body?.email as string | undefined)?.trim().toLowerCase();

    if (!groupId || !email) {
      return json({ error: "groupId and email are required" }, 400);
    }

    const { data: membership } = await adminClient
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (membership?.role !== "admin") {
      return json({ error: "Not authorized" }, 403);
    }

    const { data: group } = await adminClient
      .from("groups")
      .select("name, share_code")
      .eq("id", groupId)
      .maybeSingle();

    if (!group) {
      return json({ error: "Group not found" }, 404);
    }

    const { data: inviter } = await adminClient
      .from("users")
      .select("username")
      .eq("id", authData.user.id)
      .maybeSingle();

    const { data: invite, error: inviteError } = await adminClient
      .from("group_email_invites")
      .insert({
        group_id: groupId,
        email,
        invited_by: authData.user.id,
      })
      .select("*")
      .single();

    if (inviteError) {
      if (inviteError.code === "23505") {
        return json({ error: "Invite already sent to this email" }, 409);
      }
      return json({ error: inviteError.message }, 400);
    }

    const inviteUrl = `${appUrl.replace(/\/$/, "")}/share/group/${groupId}?invite=${group.share_code}&email=${encodeURIComponent(email)}`;

    const emailPayload = buildGroupInviteEmail({
      groupName: group.name ?? "Group",
      inviterUsername: inviter?.username ?? "Someone",
      inviteUrl,
      appUrl,
      inviteId: invite.id,
    });

    const sendResult = await sendViaResend(resendApiKey, {
      from: fromEmail,
      to: [email],
      subject: emailPayload.subject,
      html: emailPayload.html,
      text: emailPayload.text,
      idempotencyKey: emailPayload.idempotencyKey,
    });

    if (!sendResult.ok) {
      log.error("Resend failed", { message: sendResult.message });
      return json({ error: sendResult.message }, 502);
    }

    await adminClient
      .from("group_email_invites")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("id", invite.id);

    const { data: invitee } = await adminClient
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (invitee?.id) {
      const { data: inviteePrefs } = await adminClient
        .from("user_notification_preferences")
        .select("email_group_invites, in_app_enabled, in_app_social")
        .eq("user_id", invitee.id)
        .maybeSingle();

      const allowInApp =
        inviteePrefs?.in_app_enabled !== false &&
        inviteePrefs?.in_app_social !== false;

      if (allowInApp || inviteePrefs?.email_group_invites !== false) {
        await adminClient.rpc("notify_user", {
          p_user_id: invitee.id,
          p_type: "group_invite",
          p_title: `Invited to ${group.name ?? "a group"}`,
          p_body: `${inviter?.username ?? "Someone"} invited you to join ${group.name ?? "their group"}.`,
          p_data: {
            group_id: groupId,
            group_name: group.name ?? "Group",
            inviter_username: inviter?.username ?? "Someone",
          },
        });
      }
    }

    return json({ ok: true, inviteId: invite.id, emailId: sendResult.id });
  } catch (error) {
    log.error("unexpected error", { error: String(error) });
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
