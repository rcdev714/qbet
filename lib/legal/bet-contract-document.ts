import type { BetContractEventType, BetContractRecord, BetContractSnapshot } from "./bet-contract";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function buildBetContractHtml(params: {
  contract: BetContractRecord;
  eventType: BetContractEventType;
  appUrl: string;
}): string {
  const snapshot = params.contract.placed_snapshot as BetContractSnapshot;
  const resolution = params.contract.resolved_snapshot;
  const appBase = params.appUrl.replace(/\/$/, "");
  const contractUrl = `${appBase}/contract/${params.contract.bet_id}`;
  const title =
    params.eventType === "placed"
      ? "Wager Agreement — Bet Placed"
      : "Wager Agreement — Market Settled";

  const policyLinks = (snapshot.legal?.acceptedPolicies ?? [])
    .map((policy) => {
      const href = policy.url ? `${appBase}${policy.url}` : `${appBase}/terms`;
      return `<li><a href="${escapeHtml(href)}">${escapeHtml(policy.title)}</a> (${escapeHtml(policy.version)})</li>`;
    })
    .join("");

  const memberList = (snapshot.group?.members ?? [])
    .slice(0, 12)
    .map((member) => `<li>${escapeHtml(member.username)} (${escapeHtml(member.role)})</li>`)
    .join("");

  const disclaimers = (snapshot.legal?.disclaimers ?? [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  const resolutionBlock =
    resolution && params.eventType === "resolved"
      ? `<section style="margin-top:24px;">
          <h2 style="font-size:16px;margin:0 0 8px;">Settlement</h2>
          <p><strong>Outcome:</strong> ${escapeHtml(resolution.outcome.toUpperCase())}</p>
          <p><strong>Winner:</strong> ${escapeHtml(resolution.winningOptionLabel ?? "N/A")}</p>
          <p><strong>Payout:</strong> ${escapeHtml(formatMoney(Number(resolution.payoutAmount ?? 0), snapshot.wallet.currency))}</p>
          <p><strong>Resolved:</strong> ${escapeHtml(new Date(resolution.resolvedAt).toLocaleString())}</p>
        </section>`
      : "";

  return `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#0f172a;max-width:720px;margin:0 auto;padding:24px;">
  <h1 style="font-size:22px;margin:0 0 8px;">${escapeHtml(title)}</h1>
  <p style="color:#64748b;margin:0 0 24px;">Contract ${escapeHtml(snapshot.contractNumber)} · ${escapeHtml(snapshot.legal?.jurisdiction ?? params.contract.jurisdiction)}</p>

  <section>
    <h2 style="font-size:16px;margin:0 0 8px;">Parties &amp; Wallet</h2>
    <p><strong>Bettor:</strong> ${escapeHtml(snapshot.bettor.username)}</p>
    <p><strong>Wallet ID:</strong> ${escapeHtml(snapshot.wallet.walletId)}</p>
    <p><strong>Debit:</strong> ${escapeHtml(formatMoney(Number(snapshot.wallet.debitAmount), snapshot.wallet.currency))}</p>
  </section>

  <section style="margin-top:24px;">
    <h2 style="font-size:16px;margin:0 0 8px;">Market Position</h2>
    <p><strong>Question:</strong> ${escapeHtml(snapshot.market.question)}</p>
    <p><strong>Option:</strong> ${escapeHtml(snapshot.position.optionLabel)} (${escapeHtml(snapshot.position.side.toUpperCase())})</p>
    <p><strong>Stake:</strong> ${escapeHtml(formatMoney(Number(snapshot.position.amount), snapshot.wallet.currency))}</p>
    <p><strong>Placed:</strong> ${escapeHtml(new Date(snapshot.position.placedAt).toLocaleString())}</p>
  </section>

  ${
    snapshot.group
      ? `<section style="margin-top:24px;">
          <h2 style="font-size:16px;margin:0 0 8px;">Group Pool Context</h2>
          <p><strong>Group:</strong> ${escapeHtml(snapshot.group.name)}</p>
          <p><strong>Admin:</strong> ${escapeHtml(snapshot.group.adminUsername ?? "Unknown")}</p>
          <p><strong>Participants at bet time:</strong> ${snapshot.group.memberCount}</p>
          <ul>${memberList}</ul>
        </section>`
      : ""
  }

  <section style="margin-top:24px;">
    <h2 style="font-size:16px;margin:0 0 8px;">Legal Framework</h2>
    <ul>${disclaimers}</ul>
    <p>Required policies accepted:</p>
    <ul>${policyLinks || "<li>Policy acceptance records on file.</li>"}</ul>
  </section>

  ${resolutionBlock}

  <p style="margin-top:32px;">
    <a href="${escapeHtml(contractUrl)}" style="display:inline-block;background:#3B82F6;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;">View Contract</a>
  </p>
  <p style="color:#64748b;font-size:13px;">Anymarkt parimutuel prediction markets. Not investment advice. Live wallet funds involve loss risk.</p>
</body>
</html>`;
}

export function buildBetContractPlainText(params: {
  contract: BetContractRecord;
  eventType: BetContractEventType;
  appUrl: string;
}): string {
  const snapshot = params.contract.placed_snapshot as BetContractSnapshot;
  const appBase = params.appUrl.replace(/\/$/, "");
  const lines = [
    params.eventType === "placed" ? "Wager agreement — bet placed" : "Wager agreement — market settled",
    `Contract: ${snapshot.contractNumber}`,
    `Market: ${snapshot.market.question}`,
    `Stake: ${snapshot.position.amount} ${snapshot.wallet.currency}`,
    `View: ${appBase}/contract/${params.contract.bet_id}`,
  ];
  return lines.join("\n");
}
