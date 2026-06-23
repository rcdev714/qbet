import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface WalletOverviewCardProps {
  balanceLabel: string;
  balanceDisplay: string;
  subtitle?: string;
  onboardingLabel?: string;
  theme: {
    surface: string;
    border: string;
    text: string;
    textSecondary: string;
    primary: string;
  };
}

export function WalletOverviewCard({
  balanceLabel,
  balanceDisplay,
  subtitle,
  onboardingLabel,
  theme,
}: WalletOverviewCardProps) {
  return (
    <View style={styles.card}>
      <Text style={[styles.balanceLabel, { color: theme.textSecondary }]}>
        {balanceLabel}
      </Text>
      <Text style={[styles.balanceValue, { color: theme.text }]}>
        {balanceDisplay}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {subtitle}
        </Text>
      ) : null}
      {onboardingLabel ? (
        <View style={[styles.chip, { backgroundColor: `${theme.primary}1A` }]}>
          <Text style={[styles.chipText, { color: theme.primary }]}>
            {onboardingLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 8,
    marginBottom: 20,
  },
  balanceLabel: {
    textTransform: "uppercase",
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  balanceValue: {
    fontSize: 44,
    fontWeight: '400',
    marginTop: 4,
    letterSpacing: -1.5,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
  },
  chip: {
    marginTop: 10,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '400',
  },
});
