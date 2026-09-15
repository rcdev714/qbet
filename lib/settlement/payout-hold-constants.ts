/** Hours to hold live group settlement payouts before auto-release. */
export const SETTLEMENT_HOLD_HOURS = 72;

export type SettlementPayoutStatus =
  | "none"
  | "pending_release"
  | "held"
  | "released"
  | "voided";

export type PendingSettlementPayoutItem = {
  id: string;
  marketId: string;
  marketQuestion: string;
  amount: number;
  releasesAt: string;
};

export type PendingSettlementPayoutsSummary = {
  total: number;
  items: PendingSettlementPayoutItem[];
};

/** Format approximate release date for wallet incoming UI. */
export function formatIncomingReleaseDate(
  iso: string,
  locale = "en-US",
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}
