import { formatContractMoney } from "./bet-contract-document.ts";
import type { BetContractEventType, BetContractRecord, BetContractSnapshot } from "./bet-contract-types.ts";

type PdfContent = Record<string, unknown>;

function sectionTitle(text: string): PdfContent {
  return { text, style: "sectionHeader", margin: [0, 12, 0, 4] };
}

function kvRow(label: string, value: string): PdfContent {
  return {
    columns: [
      { text: label, width: 120, bold: true, color: "#475569" },
      { text: value, width: "*" },
    ],
    margin: [0, 2, 0, 2],
  };
}

export function buildBetContractPdfDocDefinition(params: {
  contract: BetContractRecord;
  eventType: BetContractEventType;
  appUrl: string;
}): PdfContent {
  const snapshot = params.contract.placed_snapshot as BetContractSnapshot;
  const resolution = params.contract.resolved_snapshot;
  const currency = snapshot.wallet.currency ?? "USD";
  const title =
    params.eventType === "placed"
      ? "Wager Agreement — Bet Placed"
      : "Wager Agreement — Market Settled";

  const content: PdfContent[] = [
    { text: "Anymarkt", style: "brand", margin: [0, 0, 0, 4] },
    { text: title, style: "title" },
    {
      text: `Contract ${snapshot.contractNumber} · ${snapshot.legal?.jurisdiction ?? params.contract.jurisdiction}`,
      style: "subtitle",
      margin: [0, 0, 0, 16],
    },
    sectionTitle("Parties & Wallet"),
    kvRow("Bettor", snapshot.bettor.username),
    kvRow("Wallet ID", snapshot.wallet.walletId),
    kvRow("Debit", formatContractMoney(Number(snapshot.wallet.debitAmount), currency)),
    sectionTitle("Market Position"),
    kvRow("Question", snapshot.market.question),
    kvRow("Option", `${snapshot.position.optionLabel} (${snapshot.position.side.toUpperCase()})`),
    kvRow("Stake", formatContractMoney(Number(snapshot.position.amount), currency)),
    kvRow("Placed", new Date(snapshot.position.placedAt).toLocaleString()),
  ];

  if (snapshot.group) {
    content.push(sectionTitle("Group Pool Context"));
    content.push(kvRow("Group", snapshot.group.name));
    content.push(kvRow("Admin", snapshot.group.adminUsername ?? "Unknown"));
    content.push(kvRow("Participants", String(snapshot.group.memberCount)));
  }

  if (resolution && params.eventType === "resolved") {
    content.push(sectionTitle("Settlement"));
    content.push(kvRow("Outcome", resolution.outcome.toUpperCase()));
    content.push(kvRow("Winner", resolution.winningOptionLabel ?? "N/A"));
    content.push(
      kvRow("Payout", formatContractMoney(Number(resolution.payoutAmount ?? 0), currency)),
    );
    content.push(kvRow("Resolved", new Date(resolution.resolvedAt).toLocaleString()));
  }

  content.push({
    text: "Anymarkt parimutuel prediction markets. Not investment advice. Live wallet funds involve loss risk.",
    style: "footer",
    margin: [0, 24, 0, 0],
  });

  return {
    pageSize: "LETTER",
    pageMargins: [48, 48, 48, 48],
    content,
    styles: {
      brand: { fontSize: 10, color: "#64748b", letterSpacing: 1 },
      title: { fontSize: 18, bold: true, color: "#0f172a" },
      subtitle: { fontSize: 10, color: "#64748b" },
      sectionHeader: { fontSize: 12, bold: true, color: "#0f172a" },
      footer: { fontSize: 8, color: "#94a3b8", italics: true },
    },
    defaultStyle: { fontSize: 10, color: "#0f172a", lineHeight: 1.3 },
  };
}

export async function buildBetContractPdfBytes(params: {
  contract: BetContractRecord;
  eventType: BetContractEventType;
  appUrl: string;
}): Promise<Uint8Array | null> {
  try {
    const pdfMakeModule = await import("https://esm.sh/pdfmake@0.2.12/build/pdfmake.js");
    const vfsModule = await import("https://esm.sh/pdfmake@0.2.12/build/vfs_fonts.js");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const maker = (pdfMakeModule as any).default ?? pdfMakeModule;
    const vfs = (vfsModule as any).default ?? vfsModule;

    if (vfs?.pdfMake?.vfs) {
      maker.vfs = vfs.pdfMake.vfs;
    }

    const docDefinition = buildBetContractPdfDocDefinition(params);
    const pdfDoc = maker.createPdf(docDefinition);
    const buffer = await pdfDoc.getBuffer();
    return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  } catch {
    return null;
  }
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function stringToBase64(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}
