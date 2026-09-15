import React from "react";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { useTheme } from "@/contexts/ThemeContext";

interface WalletOverviewCardProps {
  balanceLabel: string;
  balanceDisplay: string;
  subtitle?: string;
  onboardingLabel?: string;
  incomingTotal?: number;
  incomingDisplay?: string;
  incomingSubtitle?: string;
}

export function WalletOverviewCard({
  balanceLabel,
  balanceDisplay,
  subtitle,
  onboardingLabel,
  incomingTotal = 0,
  incomingDisplay,
  incomingSubtitle,
}: WalletOverviewCardProps) {
  const { theme } = useTheme();
  const showIncoming = incomingTotal > 0 && incomingDisplay;

  return (
    <View style={styles.card}>
      <AppText variant="caption" color="secondary" style={styles.balanceLabel}>
        {balanceLabel}
      </AppText>
      <AppText variant="title1" style={styles.balanceValue}>
        {balanceDisplay}
      </AppText>
      {subtitle ? (
        <AppText variant="bodySm" color="secondary">
          {subtitle}
        </AppText>
      ) : null}

      {showIncoming ? (
        <View style={[styles.incomingRow, { borderTopColor: theme.border }]}>
          <View style={styles.incomingLeft}>
            <AppText variant="caption" color="secondary">
              {incomingSubtitle ?? "Incoming"}
            </AppText>
            <AppText variant="body" color="success" style={styles.incomingAmount}>
              {incomingDisplay}
            </AppText>
          </View>
        </View>
      ) : null}

      {onboardingLabel ? (
        <View style={[styles.chip, { backgroundColor: theme.primarySoft }]}>
          <AppText variant="caption" color="primary">
            {onboardingLabel}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 8,
    marginBottom: 12,
    gap: 4,
  },
  balanceLabel: {
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  balanceValue: {
    letterSpacing: -0.4,
    fontVariant: ["tabular-nums"],
  },
  incomingRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  incomingLeft: {
    gap: 2,
  },
  incomingAmount: {
    fontVariant: ["tabular-nums"],
  },
  chip: {
    marginTop: 6,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
