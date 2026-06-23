import { buildEmailLayout, buildPlainTextLayout } from "../layout.ts";

export function buildBetOutcomeEmail(params: {
  marketQuestion: string;
  won: boolean;
  winningLabel: string;
  marketUrl: string;
  appUrl: string;
  notificationId: string;
}) {
  const headline = params.won
    ? `🎉 You won on "${params.marketQuestion.slice(0, 80)}"`
    : `Market resolved: "${params.marketQuestion.slice(0, 80)}"`;

  const bodyHtml = params.won
    ? `<p>Great call! Your prediction was correct.</p>
<p><strong>Market:</strong> ${params.marketQuestion}</p>
<p><strong>Winner:</strong> ${params.winningLabel}</p>`
    : `<p>The market has been settled.</p>
<p><strong>Market:</strong> ${params.marketQuestion}</p>
<p><strong>Winner:</strong> ${params.winningLabel}</p>`;

  const html = buildEmailLayout({
    title: headline,
    bodyHtml,
    ctaLabel: "View market",
    ctaUrl: params.marketUrl,
    appUrl: params.appUrl,
  });

  const text = buildPlainTextLayout({
    body: `${headline}\nWinner: ${params.winningLabel}`,
    ctaUrl: params.marketUrl,
    appUrl: params.appUrl,
  });

  return {
    subject: headline,
    html,
    text,
    idempotencyKey: `bet-outcome/${params.notificationId}`,
  };
}
