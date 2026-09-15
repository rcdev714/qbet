import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { AppButton, AppSkeleton, AppText } from "@/components/ui";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTheme } from "@/contexts/ThemeContext";
import { formatCurrency } from "@/lib/parimutuel";
import { formatIncomingReleaseDate } from "@/lib/settlement/payout-hold-constants";

import { WalletTransactionRow } from "./WalletTransactionRow";

function formatDateHeader(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const txDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (txDay.getTime() === startOfToday.getTime()) return "Today";
  if (txDay.getTime() === startOfYesterday.getTime()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function txStatusLabel(
  tx: { status?: string; metadata?: Record<string, unknown> | null },
  t: (key: string, opts?: Record<string, string>) => string,
  intlLocale: string,
): string {
  if (
    tx.status === "pending" &&
    tx.metadata &&
    (tx.metadata as { pending_settlement?: boolean }).pending_settlement
  ) {
    const releasesAt = (tx.metadata as { releases_at?: string }).releases_at;
    const date = releasesAt
      ? formatIncomingReleaseDate(releasesAt, intlLocale)
      : "";
    return date
      ? t("incomingAvailableAround", { date })
      : t("payoutPending");
  }
  if (tx.status === "cancelled") return t("payoutCancelled");
  if (tx.status === "pending") return t("payoutPending");
  return t("payoutReleased");
}

function txTitle(type: string, t: (key: string) => string): string {
  switch (type) {
    case "deposit":
      return t("depositLabel");
    case "withdrawal":
      return t("withdrawLabel");
    case "transfer_sent":
      return t("sent");
    case "transfer_received":
      return t("received");
    case "bet_placed":
      return t("betPlaced");
    case "bet_won":
      return t("betWon");
    case "bet_lost":
      return t("betLost");
    default:
      return t("history");
  }
}

interface WalletTransactionListProps {
  transactions: any[];
  loading: boolean;
  totalCount: number;
  visibleCount: number;
  onLoadMore: () => void;
  intlLocale: string;
  t: (key: string) => string;
}

export function WalletTransactionList({
  transactions,
  loading,
  totalCount,
  visibleCount,
  onLoadMore,
  intlLocale,
  t,
}: WalletTransactionListProps) {
  const { theme } = useTheme();

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const tx of transactions) {
      const header = formatDateHeader(tx.created_at);
      const bucket = map.get(header) ?? [];
      bucket.push(tx);
      map.set(header, bucket);
    }
    return Array.from(map.entries());
  }, [transactions]);

  if (loading) {
    return <AppSkeleton variant="text" style={styles.loading} />;
  }

  if (transactions.length === 0) {
    return <EmptyState icon="receipt-outline" title="No transactions yet." />;
  }

  return (
    <View>
      {grouped.map(([header, rows]) => (
        <View key={header} style={styles.section}>
          <AppText variant="caption" color="secondary" style={styles.sectionHeader}>
            {header}
          </AppText>
          {rows.map((tx, index) => {
            const isPositive = Number(tx.amount) > 0;
            const direction =
              tx.type === "transfer_sent"
                ? `To @${tx.metadata?.counterparty_username || "user"}`
                : tx.type === "transfer_received"
                  ? `From @${tx.metadata?.counterparty_username || "user"}`
                  : null;
            const time = new Date(tx.created_at).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            });
            const isPendingSettlement =
              tx.status === "pending" &&
              Boolean(tx.metadata?.pending_settlement);
            return (
              <WalletTransactionRow
                key={tx.id}
                title={txTitle(tx.type, t)}
                subtitle={direction ? `${direction} · ${time}` : time}
                amountLabel={`${isPositive ? "+" : ""}${formatCurrency(Number(tx.amount || 0), "USD", intlLocale)}`}
                statusLabel={txStatusLabel(tx, t, intlLocale)}
                isPositive={isPositive}
                isPending={isPendingSettlement}
                isLast={index === rows.length - 1}
              />
            );
          })}
        </View>
      ))}

      {totalCount > visibleCount ? (
        <View style={[styles.moreButton, { borderTopColor: theme.border }]}>
          <AppButton
            title={`See more (${Math.min(visibleCount, totalCount)} of ${totalCount})`}
            variant="ghost"
            size="sm"
            onPress={onLoadMore}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    marginVertical: 20,
    alignSelf: "center",
    width: "60%",
  },
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
    marginTop: 8,
  },
  moreButton: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
    alignItems: "center",
  },
});
