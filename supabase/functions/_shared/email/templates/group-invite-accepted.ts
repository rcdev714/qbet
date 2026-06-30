import { buildEmailLayout, buildPlainTextLayout } from "../layout.ts";

export function buildGroupInviteAcceptedEmail(params: {
  memberUsername: string;
  groupName: string;
  groupUrl: string;
  appUrl: string;
  notificationId: string;
}) {
  const subject = `@${params.memberUsername} joined ${params.groupName}`;

  const bodyHtml = `<p><strong>@${params.memberUsername}</strong> accepted your invite and joined <strong>${params.groupName}</strong>.</p>`;

  const html = buildEmailLayout({
    title: subject,
    bodyHtml,
    ctaLabel: "View group",
    ctaUrl: params.groupUrl,
    appUrl: params.appUrl,
  });

  const text = buildPlainTextLayout({
    body: subject,
    ctaUrl: params.groupUrl,
    appUrl: params.appUrl,
  });

  return {
    subject,
    html,
    text,
    idempotencyKey: `group-invite-accepted/${params.notificationId}`,
  };
}
