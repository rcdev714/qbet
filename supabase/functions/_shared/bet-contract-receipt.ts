import {
    buildBetContractAttachmentFilename,
    buildBetContractHtml,
    buildBetContractPlainText,
} from "./bet-contract-document.ts";
import { buildBetContractPdfBytes, stringToBase64, uint8ArrayToBase64 } from "./bet-contract-pdf.ts";
import type { BetContractEventType, BetContractRecord } from "./bet-contract-types.ts";
import type { ResendAttachment } from "./email/resend-client.ts";

export type ContractReceiptAttachments = {
  attachments: ResendAttachment[];
  hasPdf: boolean;
  hasHtml: boolean;
};

export async function buildContractReceiptAttachments(params: {
  contract: BetContractRecord;
  eventType: BetContractEventType;
  appUrl: string;
}): Promise<ContractReceiptAttachments> {
  const attachments: ResendAttachment[] = [];
  const filenameBase = buildBetContractAttachmentFilename(
    params.contract.contract_number,
    params.eventType,
    "pdf",
  ).replace(/\.pdf$/, "");

  const pdfBytes = await buildBetContractPdfBytes(params);
  let hasPdf = false;
  if (pdfBytes && pdfBytes.length > 0) {
    attachments.push({
      filename: `${filenameBase}.pdf`,
      content: uint8ArrayToBase64(pdfBytes),
    });
    hasPdf = true;
  }

  const html = buildBetContractHtml(params);
  attachments.push({
    filename: `${filenameBase}.html`,
    content: stringToBase64(html),
  });

  return { attachments, hasPdf, hasHtml: true };
}

export function buildContractReceiptPlainText(params: {
  contract: BetContractRecord;
  eventType: BetContractEventType;
  appUrl: string;
  hasAttachment: boolean;
}): string {
  const base = buildBetContractPlainText(params);
  if (params.hasAttachment) {
    return `${base}\n\nYour wager receipt is attached to this email.`;
  }
  return base;
}
