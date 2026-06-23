import { buildEmailLayout, buildPlainTextLayout } from "./email/layout.ts";

export function buildWelcomeUrl(appUrl: string, token: string): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/beta/welcome?token=${token}`;
}

export function buildApprovalIdempotencyKey(requestId: string, forceResend: boolean): string {
  if (forceResend) {
    return `beta-approval/${requestId}/resend-${Date.now()}`;
  }
  return `beta-approval/${requestId}`;
}

export function buildApprovalEmailHtml(params: {
  fullName: string | null;
  welcomeUrl: string;
  appUrl?: string;
}): string {
  const appUrl = params.appUrl ?? params.welcomeUrl.split("/beta/welcome")[0];
  const greeting = params.fullName ? `Hi ${params.fullName},` : "Hi there,";

  return buildEmailLayout({
    title: "Your AnyMarket beta access is approved",
    bodyHtml: `<p>${greeting}</p>
<p>Your request to join the AnyMarket private beta has been <strong>approved</strong>.</p>
<p style="color:#64748b;font-size:14px;">Use the same email address you submitted when you sign up.</p>`,
    ctaLabel: "Continue to AnyMarket",
    ctaUrl: params.welcomeUrl,
    appUrl,
  });
}

export function buildApprovalEmailText(params: {
  fullName: string | null;
  welcomeUrl: string;
  appUrl?: string;
}): string {
  const appUrl = params.appUrl ?? params.welcomeUrl.split("/beta/welcome")[0];
  const greeting = params.fullName ? `Hi ${params.fullName},` : "Hi there,";

  return buildPlainTextLayout({
    body: `${greeting}\n\nYour AnyMarket beta access is approved.`,
    ctaUrl: params.welcomeUrl,
    appUrl,
  });
}
