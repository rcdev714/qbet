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
}): string {
  const greeting = params.fullName ? `Hi ${params.fullName},` : "Hi there,";
  return `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #0f172a;">
  <p>${greeting}</p>
  <p>Your request to join the AnyMarket private beta has been <strong>approved</strong>.</p>
  <p><a href="${params.welcomeUrl}" style="display:inline-block;background:#3B82F6;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;">Continue to AnyMarket</a></p>
  <p style="color:#64748b;font-size:14px;">Use the same email address you submitted when you sign up.</p>
  <p style="color:#64748b;font-size:13px;">If the button does not work, copy this link:<br>${params.welcomeUrl}</p>
</body>
</html>`;
}
