import type { MarketType } from "../types/market";

/**
 * Detect if a market is a binary (yes/no) market.
 *
 * Priority:
 * 1. Explicit `market.market_type === 'binary'`
 * 2. Fallback: Strict label check (2 options, one "Yes", one "No")
 *
 * This hybrid approach supports:
 * - New markets with explicit type
 * - Legacy markets without the type field
 */
export function isBinaryMarket(
    market: { market_type?: MarketType | null } | null,
    options: { label: string }[],
): boolean {
    // Explicit type takes priority
    if (market?.market_type === "binary") return true;
    if (market?.market_type === "multi_option") return false;

    // Fallback: Strict label check for legacy data
    if (options.length !== 2) return false;

    const labels = options.map((o) => (o.label || "").toLowerCase().trim());
    const hasYes = labels.includes("yes");
    const hasNo = labels.includes("no");

    return hasYes && hasNo;
}

/**
 * Get the yes and no options from a binary market.
 *
 * Returns null if the market is not a strict binary market.
 */
export function getBinaryOptions<T extends { label: string }>(
    options: T[],
): { yesOption: T; noOption: T } | null {
    if (options.length !== 2) return null;

    const yesOption = options.find(
        (o) => (o.label || "").toLowerCase().trim() === "yes",
    );
    const noOption = options.find(
        (o) => (o.label || "").toLowerCase().trim() === "no",
    );

    if (!yesOption || !noOption) return null;
    return { yesOption, noOption };
}
