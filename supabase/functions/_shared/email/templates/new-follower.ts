import { buildEmailLayout, buildPlainTextLayout } from "../layout.ts";

export function buildNewFollowerEmail(params: {
  followerUsername: string;
  profileUrl: string;
  appUrl: string;
  notificationId: string;
}) {
  const subject = `@${params.followerUsername} started following you`;

  const bodyHtml = `<p><strong>@${params.followerUsername}</strong> is now following you on AnyMarket.</p>
<p>Check out their profile and see what they're predicting.</p>`;

  const html = buildEmailLayout({
    title: subject,
    bodyHtml,
    ctaLabel: "View profile",
    ctaUrl: params.profileUrl,
    appUrl: params.appUrl,
  });

  const text = buildPlainTextLayout({
    body: `${subject}. View their profile on AnyMarket.`,
    ctaUrl: params.profileUrl,
    appUrl: params.appUrl,
  });

  return {
    subject,
    html,
    text,
    idempotencyKey: `new-follower/${params.notificationId}`,
  };
}
