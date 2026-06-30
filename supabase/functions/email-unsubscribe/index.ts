// @ts-nocheck: Deno edge runtime (Supabase).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { createEdgeLogger } from "../_shared/edge-logger.ts";
import { verifyUnsubscribeToken } from "../_shared/email/unsubscribe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const html = (title: string, message: string) =>
  new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:sans-serif;padding:40px;max-width:480px;margin:auto;"><h1>${title}</h1><p>${message}</p></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders } },
  );

serve(async (req) => {
  const log = createEdgeLogger("email-unsubscribe");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let token = url.searchParams.get("token");

    if (req.method === "POST") {
      const contentType = req.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const body = await req.json();
        token = body?.token ?? token;
      } else {
        const form = await req.formData().catch(() => null);
        token = form?.get("token")?.toString() ?? token;
      }
    }

    if (!token) {
      return html("Missing token", "This unsubscribe link is invalid.");
    }

    const secret = Deno.env.get("EMAIL_UNSUBSCRIBE_SECRET") ??
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const verified = await verifyUnsubscribeToken(token, secret);

    if (!verified) {
      return html("Link expired", "This unsubscribe link is invalid or has expired.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await adminClient.rpc("apply_email_unsubscribe", {
      p_token_hash: verified.hash,
    });

    if (error || !data?.ok) {
      log.warn("unsubscribe apply failed", { error: error?.message, data });
      return html("Unable to unsubscribe", "We could not process this request. Try again from settings.");
    }

    const category = data.category as string;
    return html(
      "You're unsubscribed",
      `Email notifications for ${category.replace("_", " ")} have been turned off. You can re-enable them anytime in Settings → Notifications.`,
    );
  } catch (error) {
    log.error("unsubscribe error", { error: String(error) });
    return html("Error", "Something went wrong. Please try again later.");
  }
});
