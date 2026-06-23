import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface WalletTransactionRowProps {
  title: string;
  subtitle: string;
  amountLabel: string;
  statusLabel: string;
  isPositive: boolean;
  isLast?: boolean;
  theme: {
    text: string;
    textSecondary: string;
    success: string;
    border: string;
  };
}

export function WalletTransactionRow({
  title,
  subtitle,
  amountLabel,
  statusLabel,
  isPositive,
  isLast,
  theme,
}: WalletTransactionRowProps) {
  return (
    <View
      style={[
        styles.row,
        { borderBottomColor: theme.border },
        isLast && styles.rowLast,
      ]}
    >
      <View style={styles.left}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: isPositive ? theme.success : theme.text }]}>
          {amountLabel}
        </Text>
        <Text style={[styles.status, { color: theme.textSecondary }]}>{statusLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  left: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: "500",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  right: {
    alignItems: "flex-end",
  },
  amount: {
    fontSize: 15,
    fontWeight: '400',
    fontVariant: ["tabular-nums"],
  },
  status: {
    fontSize: 11,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
});
