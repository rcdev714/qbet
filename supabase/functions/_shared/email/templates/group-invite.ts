import { buildEmailLayout, buildPlainTextLayout } from "../layout.ts";

export function buildGroupInviteEmail(params: {
  groupName: string;
  inviterUsername: string;
  inviteUrl: string;
  appUrl: string;
  inviteId: string;
}) {
  const subject = `@${params.inviterUsername} invited you to ${params.groupName}`;

  const bodyHtml = `<p><strong>@${params.inviterUsername}</strong> invited you to join <strong>${params.groupName}</strong> on Anymarkt.</p>
<p>Join the group to bet together, chat, and compete on the leaderboard.</p>`;

  const html = buildEmailLayout({
    title: subject,
    bodyHtml,
    ctaLabel: "Accept invite",
    ctaUrl: params.inviteUrl,
    appUrl: params.appUrl,
  });

  const text = buildPlainTextLayout({
    body: `${subject}. Accept the invite to join the group.`,
    ctaUrl: params.inviteUrl,
    appUrl: params.appUrl,
  });

  return {
    subject,
    html,
    text,
    idempotencyKey: `group-invite/${params.inviteId}`,
  };
}
