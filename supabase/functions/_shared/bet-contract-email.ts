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
    return `Your Anymarkt wager agreement — ${question}`;
  }
  const outcome = params.outcome ? params.outcome.toUpperCase() : "SETTLED";
  return `Wager settled — ${outcome}: ${question}`;
}

export function buildBetContractEmailHtml(params: {
  contractNumber: string;
  marketQuestion: string;
  stakeLabel: string;
  sideLabel?: string;
  eventType: "placed" | "resolved";
  contractUrl: string;
  outcome?: string | null;
  payoutLabel?: string | null;
  appUrl?: string;
  hasAttachment?: boolean;
}): string {
  const appUrl = params.appUrl ?? params.contractUrl.split("/contract")[0];
  const subject = buildBetContractSubject({
    eventType: params.eventType,
    marketQuestion: params.marketQuestion,
    outcome: params.outcome,
  });

  const greeting =
    params.eventType === "placed"
      ? params.hasAttachment
        ? "Your wager agreement receipt is attached to this email."
        : "Your wager has been placed. View your agreement below."
      : params.hasAttachment
        ? `Your wager has been settled (${params.outcome ?? "resolved"}). Your settlement receipt is attached.`
        : `Your wager has been settled (${params.outcome ?? "resolved"}).`;

  const preheader =
    params.eventType === "placed"
      ? `Stake ${params.stakeLabel} on "${params.marketQuestion.slice(0, 80)}"`
      : `${params.outcome?.toUpperCase() ?? "SETTLED"} — ${params.payoutLabel ? `Payout ${params.payoutLabel}` : params.stakeLabel}`;

  const bodyHtml = `<span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>
<p>Hi there,</p>
<p>${greeting}</p>
<p><strong>Contract:</strong> ${params.contractNumber}</p>
<p><strong>Market:</strong> ${params.marketQuestion}</p>
${params.sideLabel ? `<p><strong>Position:</strong> ${params.sideLabel}</p>` : ""}
<p><strong>Stake:</strong> ${params.stakeLabel}</p>
${params.payoutLabel ? `<p><strong>Payout:</strong> ${params.payoutLabel}</p>` : ""}
${params.hasAttachment ? `<p style="color:#64748b;font-size:13px;">Download the attached PDF or HTML receipt for your records.</p>` : ""}`;

  return buildEmailLayout({
    title: subject,
    bodyHtml,
    ctaLabel: "View Wager Agreement",
    ctaUrl: params.contractUrl,
    appUrl,
    footerNote: "Required wager receipt — Anymarkt. Live wallet funds involve loss risk.",
  });
}

export function buildBetContractEmailText(params: {
  contractNumber: string;
  marketQuestion: string;
  stakeLabel: string;
  sideLabel?: string;
  eventType: "placed" | "resolved";
  contractUrl: string;
  outcome?: string | null;
  payoutLabel?: string | null;
  appUrl?: string;
  hasAttachment?: boolean;
}): string {
  const appUrl = params.appUrl ?? params.contractUrl.split("/contract")[0];
  const lines = [
    `Contract: ${params.contractNumber}`,
    `Market: ${params.marketQuestion}`,
    params.sideLabel ? `Position: ${params.sideLabel}` : "",
    `Stake: ${params.stakeLabel}`,
    params.payoutLabel ? `Payout: ${params.payoutLabel}` : "",
    params.hasAttachment ? "Receipt attached to this email." : "",
  ].filter(Boolean);

  return buildPlainTextLayout({
    body: lines.join("\n"),
    ctaUrl: params.contractUrl,
    appUrl,
  });
}
