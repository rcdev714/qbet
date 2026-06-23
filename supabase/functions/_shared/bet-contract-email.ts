import { buildEmailLayout, buildPlainTextLayout } from "./email/layout.ts";

export function buildBetContractIdempotencyKey(
  contractId: string,
  eventType: "placed" | "resolved",
  forceResend = false,
): string {
  if (forceResend) {
    return `bet-contract/${contractId}/${eventType}/resend-${Date.now()}`;
  }
  return `bet-contract/${contractId}/${eventType}`;
}

export function buildBetContractSubject(params: {
  eventType: "placed" | "resolved";
  marketQuestion: string;
  outcome?: string | null;
}): string {
  const question = params.marketQuestion.slice(0, 60);
  if (params.eventType === "placed") {
    return `Your AnyMarket wager agreement — ${question}`;
  }
  const outcome = params.outcome ? params.outcome.toUpperCase() : "SETTLED";
  return `Wager settled — ${outcome}: ${question}`;
}

export function buildBetContractEmailHtml(params: {
  contractNumber: string;
  marketQuestion: string;
  stakeLabel: string;
  eventType: "placed" | "resolved";
  contractUrl: string;
  outcome?: string | null;
  payoutLabel?: string | null;
  appUrl?: string;
}): string {
  const greeting =
    params.eventType === "placed"
      ? "Your wager agreement is attached below."
      : `Your wager has been settled (${params.outcome ?? "resolved"}).`;

  const appUrl = params.appUrl ?? params.contractUrl.split("/wallet")[0];

  const bodyHtml = `<p>Hi there,</p>
<p>${greeting}</p>
<p><strong>Contract:</strong> ${params.contractNumber}</p>
<p><strong>Market:</strong> ${params.marketQuestion}</p>
<p><strong>Stake:</strong> ${params.stakeLabel}</p>
${params.payoutLabel ? `<p><strong>Payout:</strong> ${params.payoutLabel}</p>` : ""}`;

  return buildEmailLayout({
    title: buildBetContractSubject({
      eventType: params.eventType,
      marketQuestion: params.marketQuestion,
      outcome: params.outcome,
    }),
    bodyHtml,
    ctaLabel: "View Wager Agreement",
    ctaUrl: params.contractUrl,
    appUrl,
    footerNote: "AnyMarket — social prediction infrastructure. Live wallet funds involve loss risk.",
  });
}

export function buildBetContractEmailText(params: {
  contractNumber: string;
  marketQuestion: string;
  stakeLabel: string;
  eventType: "placed" | "resolved";
  contractUrl: string;
  appUrl?: string;
}): string {
  const appUrl = params.appUrl ?? params.contractUrl.split("/wallet")[0];
  return buildPlainTextLayout({
    body: `Contract: ${params.contractNumber}\nMarket: ${params.marketQuestion}\nStake: ${params.stakeLabel}`,
    ctaUrl: params.contractUrl,
    appUrl,
  });
}
