import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { formatCurrency } from "../../lib/parimutuel";
import { BetWithDetails } from "../../types/market";

interface BetHistoryCardProps {
  bet: BetWithDetails;
}

export function BetHistoryCard({ bet }: BetHistoryCardProps) {
  const { theme } = useTheme();

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

  // const isWon = statusText === "Won";

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Text style={[styles.marketQuestion, { color: theme.text }]} numberOfLines={2}>
          {bet.markets?.question || "Unknown Market"}
        </Text>
        <Text style={[styles.date, { color: theme.textSecondary }]}>
          {new Date(bet.placed_at).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.detailsRow}>
        <View>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Constructed Bet</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  marketQuestion: {
    fontSize: 15,
    fontWeight: "600",
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
    fontWeight: "600",
  },
  option: {
    fontSize: 15,
    fontWeight: "600",
  },
  amount: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  status: {
    fontSize: 13,
    fontWeight: "600",
  },
});
