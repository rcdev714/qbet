// @ts-nocheck: This is a workaround to allow the use of the Stripe API in the Deno runtime.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
    const url = new URL(req.url);
    // 'status' can be 'return' (success) or 'refresh' (re-trigger) or 'completed'
    const status = url.searchParams.get("status") || "return";

    // This is the custom scheme for your app
    const appScheme = "qbet://wallet";
    const deepLink = `${appScheme}?status=${status}`;

    // Return an HTML page that tries to open the app, with a manual fallback.
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Return to Qbet</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; background: #0f172a; color: #f8fafc; }
      .card { max-width: 480px; margin: 10vh auto; background: #111827; border-radius: 12px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.35); }
      h1 { font-size: 20px; margin: 0 0 12px; }
      p { margin: 0 0 16px; color: #cbd5f5; }
      a { display: inline-block; background: #2563eb; color: white; padding: 12px 16px; border-radius: 10px; text-decoration: none; }
      code { color: #93c5fd; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Account onboarded</h1>
      <p>Your Stripe onboarding is complete. Tap below to return to the app.</p>
      <a href="${deepLink}">Return to Qbet</a>
      <p style="margin-top:16px;font-size:12px;">If nothing happens, reopen the Qbet app manually.</p>
      <p style="font-size:12px;">Deep link: <code>${deepLink}</code></p>
    </div>
    <script>
      setTimeout(() => { window.location.href = "${deepLink}"; }, 200);
    </script>
  </body>
</html>`;

    return new Response(html, {
        status: 200,
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store"
        }
    });
});
