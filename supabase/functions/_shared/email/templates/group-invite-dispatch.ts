import { buildEmailLayout, buildPlainTextLayout } from "../layout.ts";

export function buildGroupInviteDispatchEmail(params: {
  groupName: string;
  inviterUsername: string;
  groupUrl: string;
  appUrl: string;
  notificationId: string;
}) {
  const subject = `@${params.inviterUsername} invited you to ${params.groupName}`;

  const bodyHtml = `<p><strong>@${params.inviterUsername}</strong> invited you to join <strong>${params.groupName}</strong>.</p>
<p>Open the group to accept and start betting together.</p>`;

  const html = buildEmailLayout({
    title: subject,
    bodyHtml,
    ctaLabel: "View invite",
    ctaUrl: params.groupUrl,
    appUrl: params.appUrl,
  });

  const text = buildPlainTextLayout({
    body: `${subject}. Open Anymarkt to accept.`,
    ctaUrl: params.groupUrl,
    appUrl: params.appUrl,
  });

  return {
    subject,
    html,
    text,
    idempotencyKey: `group-invite-dispatch/${params.notificationId}`,
  };
}
