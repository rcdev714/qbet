import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { formatCurrency } from "@/lib/parimutuel";

interface MarketTradePanelProps {
  balance: number;
  totalPool: number;
  isPlayMode: boolean;
  hasSelection: boolean;
  theme: {
    surface: string;
    border: string;
    text: string;
    textSecondary: string;
    primary: string;
    success: string;
    primarySoft: string;
  };
}

/** Desktop sticky sidebar summary for market detail (Polymarket-style). */
export function MarketTradePanel({
  balance,
  totalPool,
  isPlayMode,
  hasSelection,
  theme,
}: MarketTradePanelProps) {
  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: theme.surface, borderLeftColor: theme.border },
        Platform.OS === "web"
          ? ({
              position: "sticky",
              top: 0,
              alignSelf: "flex-start",
              maxHeight: "100vh",
            } as any)
          : null,
      ]}
    >
      <View style={[styles.modePill, { backgroundColor: isPlayMode ? theme.primarySoft : "rgba(52, 199, 89, 0.16)" }]}>
        <Text style={[styles.modePillText, { color: isPlayMode ? theme.primary : theme.success }]}>
          {isPlayMode ? "Practice" : "Live"}
        </Text>
      </View>

      <AppText variant="title3" style={styles.title}>
        Trade
      </AppText>

      <View style={styles.statBlock}>
        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Your balance</Text>
        <Text style={[styles.statValue, { color: theme.text }]}>{formatCurrency(balance)}</Text>
      </View>

      <View style={styles.statBlock}>
        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Market pool</Text>
        <Text style={[styles.statValue, { color: theme.text }]}>{formatCurrency(totalPool)}</Text>
      </View>

      <Text style={[styles.hint, { color: hasSelection ? theme.primary : theme.textSecondary }]}>
        {hasSelection ? "Enter an amount below to confirm your bet." : "Select Yes or No on the left to start."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: 320,
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  modePill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  modePillText: {
    fontSize: 11,
    fontWeight: '400',
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  title: {
    marginBottom: 16,
  },
  statBlock: {
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '400',
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '400',
    letterSpacing: -0.5,
  },
  hint: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
  },
});
