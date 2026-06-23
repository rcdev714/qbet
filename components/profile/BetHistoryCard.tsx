import { useRouter } from "expo-router";
import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { formatCurrency } from "../../lib/parimutuel";
import { BetWithDetails } from "../../types/market";

interface BetHistoryCardProps {
  bet: BetWithDetails;
}

export function BetHistoryCard({ bet }: BetHistoryCardProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const isLiveBet = bet.is_play_mode !== true;

  // Determine status color and text
  let statusColor = theme.textSecondary;
  let statusText = "Pending";
  
  if (bet.markets?.status === "resolved") {
     if (bet.markets.winning_option_id === bet.option_id) {
         statusColor = "#34C759"; // Green
         statusText = "Won";
     } else if (bet.markets.winning_option_id) {
         statusColor = theme.textSecondary; // Grey for lost usually, or red
         statusText = "Lost";
     }
  }

  const isWeb = Platform.OS === "web";

  const content = (
    <>
      <View style={[styles.header, isWeb && styles.headerWeb]}>
        <Text style={[styles.marketQuestion, { color: theme.text }]} numberOfLines={isWeb ? 1 : 2}>
          {bet.markets?.question || "Unknown Market"}
        </Text>
        <View style={isWeb ? styles.webRight : undefined}>
          <Text style={[styles.amount, { color: theme.text }]}>
            {formatCurrency(bet.amount)}
          </Text>
          <Text style={[styles.status, { color: statusColor }]}>
            {statusText}
          </Text>
        </View>
      </View>

      {!isWeb ? (
      <View style={styles.detailsRow}>
        <View>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            {isLiveBet ? "Live Position" : "Practice Position"}
          </Text>
          <Text style={[styles.option, { color: theme.primary }]}>
            {bet.options?.label || "Unknown Option"}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[styles.amount, { color: theme.text }]}>
            {formatCurrency(bet.amount)}
          </Text>
          <Text style={[styles.status, { color: statusColor }]}>
            {statusText}
          </Text>
        </View>
      </View>
      ) : (
        <Text style={[styles.webMeta, { color: theme.textSecondary }]} numberOfLines={1}>
          {bet.options?.label || "Unknown Option"} · {new Date(bet.placed_at).toLocaleDateString()}
        </Text>
      )}

      {isLiveBet ? (
        <Text style={[styles.contractHint, { color: theme.primary }]}>
          View wager agreement →
        </Text>
      ) : null}
    </>
  );

  if (!isLiveBet) {
    return (
      <View style={[styles.container, isWeb && styles.containerWeb, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {content}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, isWeb && styles.containerWeb, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={() => router.push(`/contract/${bet.id}` as any)}
      accessibilityRole="button"
      accessibilityLabel="Open wager agreement"
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  containerWeb: {
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderWidth: 0,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerWeb: {
    alignItems: "center",
    marginBottom: 4,
    gap: 12,
  },
  webRight: {
    alignItems: "flex-end",
    minWidth: 72,
  },
  webMeta: {
    fontSize: 12,
  },
  marketQuestion: {
    fontSize: 15,
    fontWeight: '400',
    flex: 1,
    paddingRight: 16,
  },
  date: {
    fontSize: 12,
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 11,
    textTransform: "uppercase",
    marginBottom: 2,
    fontWeight: '400',
  },
  option: {
    fontSize: 15,
    fontWeight: '400',
  },
  amount: {
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 2,
  },
  status: {
    fontSize: 13,
    fontWeight: '400',
  },
  contractHint: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '400',
  },
});
