import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { formatCurrency } from "../../lib/parimutuel";
import {
    playStatsService,
    type PlayBet,
} from "../../services/play-stats.service";

interface PlayBetDetailViewProps {
  marketId: string;
  options: { id: string; label: string }[];
}

/** Shows play-mode bet distribution and stats for a specific market */
export function PlayBetDetailView({
  marketId,
  options,
}: PlayBetDetailViewProps) {
  const { theme, isDark } = useTheme();
  const [bets, setBets] = useState<PlayBet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBets = async () => {
      try {
        const marketBets =
          await playStatsService.getPlayBetsForMarket(marketId);
        setBets(marketBets);
      } catch (e) {
        console.error("Failed to load play bets for market:", e);
      } finally {
        setLoading(false);
      }
    };

    loadBets();
  }, [marketId]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (bets.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          No play bets on this market
        </Text>
      </View>
    );
  }

  // Calculate per-option pool distribution
  const optionPools: Record<string, { yes: number; no: number; total: number }> = {};
  options.forEach((o) => (optionPools[o.id] = { yes: 0, no: 0, total: 0 }));

  let totalPool = 0;

  bets.forEach((bet) => {
    const pool = optionPools[bet.option_id];
    if (pool) {
      const amount = bet.amount;
      if (bet.side === "yes") {
        pool.yes += amount;
      } else {
        pool.no += amount;
      }
      pool.total += amount;
      totalPool += amount;
    }
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Play Bet Distribution
        </Text>
      </View>

      {/* Total pool */}
      <View
        style={[styles.totalRow, { borderBottomColor: theme.border }]}
      >
        <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>
          Total Play Pool
        </Text>
        <Text style={[styles.totalValue, { color: theme.text }]}>
          {formatCurrency(totalPool)}
        </Text>
      </View>

      {/* Per-option breakdown */}
      {options.map((option) => {
        const pool = optionPools[option.id];
        if (!pool) return null;
        const pct = totalPool > 0 ? (pool.total / totalPool) * 100 : 0;

        return (
          <View
            key={option.id}
            style={[
              styles.optionRow,
              { backgroundColor: isDark ? theme.surface : "#F8F8FA" },
            ]}
          >
            <View style={styles.optionHeader}>
              <Text
                style={[styles.optionLabel, { color: theme.text }]}
                numberOfLines={1}
              >
                {option.label}
              </Text>
              <Text
                style={[styles.optionPct, { color: "#007AFF" }]}
              >
                {pct.toFixed(0)}%
              </Text>
            </View>

            {/* Progress bar */}
            <View
              style={[
                styles.progressBg,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(0,0,0,0.04)",
                },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${pct}%`,
                    backgroundColor: "#007AFF",
                    opacity: 0.7,
                  },
                ]}
              />
            </View>

            <View style={styles.poolRow}>
              <Text
                style={[styles.poolText, { color: theme.textSecondary }]}
              >
                {formatCurrency(pool.total)} · {bets.filter((b) => b.option_id === option.id).length} bet
                {bets.filter((b) => b.option_id === option.id).length !==
                    1
                  ? "s"
                  : ""}
              </Text>
            </View>
          </View>
        );
      })}

      {/* Info note */}
      <View style={styles.infoRow}>
        <Ionicons
          name="information-circle-outline"
          size={14}
          color="#007AFF"
        />
        <Text style={[styles.infoText, { color: theme.textSecondary }]}>
          Play bets use real market odds but don&apos;t affect the pool
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: "400",
  },
  totalValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  optionRow: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  optionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: "400",
    flex: 1,
  },
  optionPct: {
    fontSize: 14,
    fontWeight: "600",
  },
  progressBg: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  poolRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  poolText: {
    fontSize: 11,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: "italic",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
    paddingTop: 10,
  },
  infoText: {
    fontSize: 11,
    flex: 1,
  },
});
