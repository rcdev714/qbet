import { formatContractMoney } from "./bet-contract-document.ts";
import {
    buildBetContractEmailHtml,
    buildBetContractEmailText,
    buildBetContractIdempotencyKey,
    buildBetContractSubject,
} from "./bet-contract-email.ts";
import { buildContractReceiptAttachments, buildContractReceiptPlainText } from "./bet-contract-receipt.ts";
import type { BetContractEventType, BetContractRecord } from "./bet-contract-types.ts";
import { sendViaResend, type ResendSendResult } from "./email/resend-client.ts";

export async function sendBetContractEmail(params: {
  contract: BetContractRecord;
  eventType: BetContractEventType;
  toEmail: string;
  fromEmail: string;
  appUrl: string;
  resendApiKey: string;
  forceResend?: boolean;
}): Promise<ResendSendResult & { hasAttachment?: boolean }> {
  const snapshot = params.contract.placed_snapshot;
  const resolution = params.contract.resolved_snapshot;
  const currency = snapshot?.wallet?.currency ?? "USD";
  const stakeAmount = Number(snapshot?.position?.amount ?? 0);
  const stakeLabel = formatContractMoney(stakeAmount, currency);
  const sideLabel = snapshot?.position
    ? `${snapshot.position.optionLabel} (${snapshot.position.side.toUpperCase()})`
    : undefined;
  const marketQuestion = snapshot?.market?.question ?? "Market";
  const contractUrl = `${params.appUrl.replace(/\/$/, "")}/contract/${params.contract.bet_id}`;

  const payoutLabel =
    resolution?.payoutAmount != null
      ? formatContractMoney(Number(resolution.payoutAmount), currency)
      : null;

  const { attachments, hasPdf } = await buildContractReceiptAttachments({
    contract: params.contract,
    eventType: params.eventType,
    appUrl: params.appUrl,
  });

  const hasAttachment = hasPdf || attachments.length > 0;
  const subject = buildBetContractSubject({
    eventType: params.eventType,
    marketQuestion,
    outcome: resolution?.outcome ?? null,
  });

  const html = buildBetContractEmailHtml({
    contractNumber: params.contract.contract_number,
    marketQuestion,
    stakeLabel,
    sideLabel,
    eventType: params.eventType,
    contractUrl,
    outcome: resolution?.outcome ?? null,
    payoutLabel,
    appUrl: params.appUrl,
    hasAttachment,
  });

  const text =
    buildBetContractEmailText({
      contractNumber: params.contract.contract_number,
      marketQuestion,
      stakeLabel,
      sideLabel,
      eventType: params.eventType,
      contractUrl,
      outcome: resolution?.outcome ?? null,
      payoutLabel,
      appUrl: params.appUrl,
      hasAttachment,
    }) ||
    buildContractReceiptPlainText({
      contract: params.contract,
      eventType: params.eventType,
      appUrl: params.appUrl,
      hasAttachment,
    });

  const result = await sendViaResend(params.resendApiKey, {
    from: params.fromEmail,
    to: [params.toEmail],
    subject,
    html,
    text,
    idempotencyKey: buildBetContractIdempotencyKey(
      params.contract.id,
      params.eventType,
      params.forceResend,
    ),
    attachments: hasAttachment ? attachments : undefined,
  });

  return { ...result, hasAttachment };
}
