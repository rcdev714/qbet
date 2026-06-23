import { buildEmailLayout, buildPlainTextLayout } from "../layout.ts";

export function buildMarketResolvedEmail(params: {
  marketQuestion: string;
  winningLabel: string;
  isPublic: boolean;
  marketUrl: string;
  appUrl: string;
  notificationId: string;
}) {
  const subject = params.isPublic
    ? `Public market settled: ${params.marketQuestion.slice(0, 60)}`
    : `Group bet settled: ${params.marketQuestion.slice(0, 60)}`;

  const context = params.isPublic
    ? "A public market you follow or created has been resolved."
    : "A prediction in your group has been settled.";

  const bodyHtml = `<p>${context}</p>
<p><strong>Market:</strong> ${params.marketQuestion}</p>
<p><strong>Winner:</strong> ${params.winningLabel}</p>`;

  const html = buildEmailLayout({
    title: subject,
    bodyHtml,
    ctaLabel: "View result",
    ctaUrl: params.marketUrl,
    appUrl: params.appUrl,
  });

  const text = buildPlainTextLayout({
    body: `${subject}\nWinner: ${params.winningLabel}`,
    ctaUrl: params.marketUrl,
    appUrl: params.appUrl,
  });

  return {
    subject,
    html,
    text,
    idempotencyKey: `market-resolved/${params.notificationId}`,
  };
}
