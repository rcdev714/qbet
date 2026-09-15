import React from "react";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { useTheme } from "@/contexts/ThemeContext";

interface WalletTransactionRowProps {
  title: string;
  subtitle: string;
  amountLabel: string;
  statusLabel: string;
  isPositive: boolean;
  isPending?: boolean;
  isLast?: boolean;
}

export function WalletTransactionRow({
  title,
  subtitle,
  amountLabel,
  statusLabel,
  isPositive,
  isPending = false,
  isLast,
}: WalletTransactionRowProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.row,
        { borderBottomColor: theme.border },
        isLast && styles.rowLast,
      ]}
    >
      <View style={styles.left}>
        <AppText variant="body" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" color="secondary" numberOfLines={1}>
          {subtitle}
        </AppText>
      </View>
      <View style={styles.right}>
        <AppText
          variant="body"
          color={isPending ? "secondary" : isPositive ? "success" : "default"}
          style={styles.amount}
        >
          {amountLabel}
        </AppText>
        <AppText variant="caption" color="secondary" style={styles.status}>
          {statusLabel}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  left: {
    flex: 1,
    paddingRight: 12,
    gap: 2,
  },
  right: {
    alignItems: "flex-end",
    gap: 2,
  },
  amount: {
    fontVariant: ["tabular-nums"],
  },
  status: {
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
});
