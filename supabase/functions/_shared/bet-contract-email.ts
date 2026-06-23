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
}): string {
  const greeting =
    params.eventType === "placed"
      ? "Your wager agreement is attached below."
      : `Your wager has been settled (${params.outcome ?? "resolved"}).`;

  return `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#0f172a;">
  <p>Hi there,</p>
  <p>${greeting}</p>
  <p><strong>Contract:</strong> ${params.contractNumber}</p>
  <p><strong>Market:</strong> ${params.marketQuestion}</p>
  <p><strong>Stake:</strong> ${params.stakeLabel}</p>
  ${params.payoutLabel ? `<p><strong>Payout:</strong> ${params.payoutLabel}</p>` : ""}
  <p><a href="${params.contractUrl}" style="display:inline-block;background:#3B82F6;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;">View Wager Agreement</a></p>
  <p style="color:#64748b;font-size:13px;">AnyMarket — social prediction infrastructure. Live wallet funds involve loss risk.</p>
</body>
</html>`;
}
