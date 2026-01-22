// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
    const url = new URL(req.url);
    // 'status' can be 'return' (success) or 'refresh' (re-trigger) or 'completed'
    const status = url.searchParams.get("status") || "return";

    // This is the custom scheme for your app
    const appScheme = "qbet://wallet";

    // Redirect back to the app
    return Response.redirect(`${appScheme}?status=${status}`, 302);
});
