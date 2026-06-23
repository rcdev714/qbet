import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    View
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { formatCurrency } from "../../lib/parimutuel";
import {
    playStatsService,
    type PlayStats,
} from "../../services/play-stats.service";
import type { BetWithDetails } from "../../types/market";
import { PlayStatsChart } from "./PlayStatsChart";

interface PlayStatsViewProps {
  userId?: string;
}

export function PlayStatsView({ userId }: PlayStatsViewProps) {
  const { theme, isDark } = useTheme();
  const [stats, setStats] = useState<PlayStats | null>(null);
  const [bets, setBets] = useState<BetWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlayStats = async () => {
      try {
        const [playStats, playBets] = await Promise.all([
          playStatsService.getPlayStats(userId),
          playStatsService.getPlayBetsWithDetails(userId),
        ]);
        setStats(playStats);
        setBets(playBets);
      } catch (e) {
        console.error("Failed to load play stats:", e);
      } finally {
        setLoading(false);
      }
    };

    loadPlayStats();
  }, [userId]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!stats || stats.totalBets === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
      <View style={{ marginBottom: 16 }}>
        <Ionicons name="game-controller" size={48} color={isDark ? theme.border : "#E5E5EA"} />
      </View>
        <Text
          style={[
            styles.emptyText,
            { color: theme.textSecondary, marginTop: 12 },
          ]}
        >
          No play bets yet
        </Text>
        <Text
          style={[
            styles.emptySubtext,
            { color: theme.textSecondary, marginTop: 4 },
          ]}
        >
          Place bets in play mode to see your stats here
        </Text>
      </View>
    );
  }

  const StatCard = ({
    label,
    value,
    color,
    icon,
  }: {
    label: string;
    value: string;
    color?: string;
    icon: keyof typeof Ionicons.glyphMap;
  }) => (
    <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
      <View style={styles.statHeader}>
        <Ionicons
          name={icon}
          size={16}
          color={color || theme.textSecondary}
        />
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.value, { color: color || theme.text }]}>
        {value}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <PlayStatsChart bets={bets} />

      <View style={styles.grid}>
        <StatCard
          label="Total Wagered"
          value={formatCurrency(stats.totalWagered)}
          icon="wallet-outline"
        />
        <StatCard
          label="Total Won"
          value={formatCurrency(stats.totalWon)}
          color={theme.primary}
          icon="trending-up-outline"
        />
        <StatCard
          label="Best Win"
          value={formatCurrency(stats.bestWin)}
          icon="trophy-outline"
        />
        <StatCard
          label="Win Rate"
          value={`${stats.winRate.toFixed(0)}%`}
          icon="analytics-outline"
        />
      </View>

      {/* Play mode info banner */}
      <View
        style={[
          styles.infoBanner,
          {
            backgroundColor: isDark
              ? "rgba(0,122,255,0.1)"
              : "rgba(0,122,255,0.08)",
            borderColor: isDark
              ? "rgba(0,122,255,0.2)"
              : "rgba(0,122,255,0.15)",
          },
        ]}
      >
        <Ionicons name="information-circle-outline" size={16} color={theme.primary} />
        <Text style={[styles.infoText, { color: theme.textSecondary }]}>
          Play mode stats are tracked locally. They don&apos;t affect your real
          balance.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 60,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  statCard: {
    width: "45%",
    flexGrow: 1,
    margin: 8,
    padding: 16,
    borderRadius: 20,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.5,
  },
  infoBanner: {
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
  },
  infoText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  emptyBadge: {
    backgroundColor: "#FF9500",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  emptyBadgeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
  },
  emptySubtext: {
    fontSize: 13,
  },
});
