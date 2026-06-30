import { buildEmailLayout, buildPlainTextLayout } from "../layout.ts";

export function buildBetaApprovedEmail(params: {
  fullName: string | null;
  welcomeUrl: string;
  appUrl: string;
  requestId: string;
  forceResend?: boolean;
}) {
  const greeting = params.fullName ? `Hi ${params.fullName},` : "Hi there,";

  const bodyHtml = `<p>${greeting}</p>
<p>Your request to join the Anymarkt private beta has been <strong>approved</strong>.</p>
<p style="color:#64748b;font-size:14px;">Use the same email address you submitted when you sign up.</p>`;

  const html = buildEmailLayout({
    title: "Your Anymarkt beta access is approved",
    bodyHtml,
    ctaLabel: "Continue to Anymarkt",
    ctaUrl: params.welcomeUrl,
    appUrl: params.appUrl,
  });

  const text = buildPlainTextLayout({
    body: `${greeting}\n\nYour Anymarkt beta access is approved. Continue here:`,
    ctaUrl: params.welcomeUrl,
    appUrl: params.appUrl,
  });

  const idempotencyKey = params.forceResend
    ? `beta-approval/${params.requestId}/resend-${Date.now()}`
    : `beta-approval/${params.requestId}`;

  return {
    subject: "Your Anymarkt beta access is approved",
    html,
    text,
    idempotencyKey,
  };
}
