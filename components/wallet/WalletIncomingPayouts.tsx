import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { useTheme } from "@/contexts/ThemeContext";
import { formatIncomingReleaseDate } from "@/lib/settlement/payout-hold-constants";
import type { PendingSettlementPayoutItem } from "@/lib/settlement/payout-hold-constants";
import { formatCurrency } from "@/lib/parimutuel";

type WalletIncomingPayoutsProps = {
  items: PendingSettlementPayoutItem[];
  intlLocale: string;
  incomingLabel: string;
  availableAroundLabel: (date: string) => string;
};

export function WalletIncomingPayouts({
  items,
  intlLocale,
  incomingLabel,
  availableAroundLabel,
}: WalletIncomingPayoutsProps) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  const earliest = items.reduce((min, item) => {
    return !min || new Date(item.releasesAt) < new Date(min.releasesAt) ? item : min;
  }, items[0]);

  const earliestDate = formatIncomingReleaseDate(earliest.releasesAt, intlLocale);

  return (
    <View style={[styles.wrap, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          <AppText variant="caption" color="secondary">
            {incomingLabel}
          </AppText>
          <AppText variant="bodySm" color="primary">
            {availableAroundLabel(earliestDate)}
          </AppText>
        </View>
        <AppText variant="caption" color="secondary">
          {expanded ? "▲" : "▼"}
        </AppText>
      </Pressable>

      {expanded ? (
        <View style={styles.list}>
          {items.map((item) => (
            <View key={item.id} style={styles.row}>
              <AppText variant="bodySm" numberOfLines={1} style={styles.question}>
                {item.marketQuestion}
              </AppText>
              <View style={styles.rowRight}>
                <AppText variant="bodySm" color="success">
                  +{formatCurrency(item.amount, "USD", intlLocale)}
                </AppText>
                <AppText variant="caption" color="secondary">
                  ~{formatIncomingReleaseDate(item.releasesAt, intlLocale)}
                </AppText>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  list: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingTop: 8,
  },
  question: {
    flex: 1,
  },
  rowRight: {
    alignItems: "flex-end",
    gap: 2,
  },
});
