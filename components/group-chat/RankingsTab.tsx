import { AuraBadge } from "@/components/profile/AuraBadge";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/ThemeContext";
import { formatCurrency } from "@/lib/parimutuel";
import { supabase } from "@/lib/supabase";
import type { Market } from "@/types/market";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from "react-native";

interface RankingsTabProps {
  groupId: string;
  members: any[];
  markets: Market[];
  currentUserId?: string;
}

interface LeaderboardEntry {
  userId: string;
  username: string;
  totalBets: number;
  wins: number;
  losses: number;
  netPnL: number;
}

const MEDAL = ["🥇", "🥈", "🥉"];

export function RankingsTab({ groupId, members, markets, currentUserId }: RankingsTabProps) {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLeaderboard = useCallback(async () => {
    try {
      setLoading(true);

      // Get resolved markets in this group
      const resolvedMarkets = markets.filter(
        (m) => (m.status === "resolved" || m.status === "closed") && m.group_id === groupId,
      );
      if (resolvedMarkets.length === 0) {
        // Still build entries for all members with zero stats
        const entries: LeaderboardEntry[] = members.map((m) => ({
          userId: m.user_id,
          username: m.users?.username || m.users?.email?.split("@")[0] || "Anonymous",
          totalBets: 0,
          wins: 0,
          losses: 0,
          netPnL: 0,
        }));
        setLeaderboard(entries);
        return;
      }

      const marketIds = resolvedMarkets.map((m) => m.id);

      // Fetch all bets on these markets
      const { data: bets, error } = await (supabase
        .from("bets")
        .select("user_id, market_id, option_id, amount, payout")
        .in("market_id", marketIds) as any);

      if (error) {
        console.error("Error fetching leaderboard bets:", error);
        return;
      }

      // Build per-user stats
      const statsMap = new Map<string, LeaderboardEntry>();

      // Initialize all members
      for (const m of members) {
        statsMap.set(m.user_id, {
          userId: m.user_id,
          username: m.users?.username || m.users?.email?.split("@")[0] || "Anonymous",
          totalBets: 0,
          wins: 0,
          losses: 0,
          netPnL: 0,
        });
      }

      // Build a map of market -> winning_option_id
      const resolvedOptionMap = new Map<string, string>();
      for (const m of resolvedMarkets) {
        if (m.winning_option_id) {
          resolvedOptionMap.set(m.id, m.winning_option_id);
        }
      }

      // Process bets
      for (const bet of (bets || [])) {
        const entry = statsMap.get(bet.user_id);
        if (!entry) continue;

        entry.totalBets += 1;
        const resolvedOptionId = resolvedOptionMap.get(bet.market_id);

        if (resolvedOptionId) {
          if (bet.option_id === resolvedOptionId) {
            entry.wins += 1;
            // Payout minus original amount = profit
            const payout = bet.payout || 0;
            entry.netPnL += (payout - bet.amount);
          } else {
            entry.losses += 1;
            entry.netPnL -= bet.amount;
          }
        }
      }

      // Sort by wins desc, then netPnL desc
      const sorted = Array.from(statsMap.values()).sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.netPnL - a.netPnL;
      });

      setLeaderboard(sorted);
    } catch (err) {
      console.error("Error loading leaderboard:", err);
    } finally {
      setLoading(false);
    }
  }, [groupId, members, markets]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={leaderboard}
      keyExtractor={(item) => item.userId}
      renderItem={({ item, index }) => {
        const isMe = item.userId === currentUserId;
        const winRate = item.totalBets > 0 ? item.wins / item.totalBets : 0;
        return (
          <Pressable
            onPress={() => router.push(`/profile/${item.userId}` as any)}
            style={[
              styles.row,
              {
                backgroundColor: isMe
                  ? (isDark ? "rgba(0,122,255,0.1)" : "rgba(0,122,255,0.05)")
                  : theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.rankCol}>
              {index < 3 ? (
                <Text style={styles.medal}>{MEDAL[index]}</Text>
              ) : (
                <Text style={[styles.rankNum, { color: theme.textSecondary }]}>
                  {index + 1}
                </Text>
              )}
            </View>

            <View style={styles.userCol}>
              <View style={styles.nameRow}>
                <Text
                  style={[styles.username, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {item.username}
                  {isMe ? " (You)" : ""}
                </Text>
                {item.totalBets >= 5 ? <AuraBadge winRate={winRate} compact /> : null}
              </View>
              <Text style={[styles.statsLine, { color: theme.textSecondary }]}>
                {item.totalBets} bet{item.totalBets !== 1 ? "s" : ""} · {item.wins}W / {item.losses}L
              </Text>
            </View>

            <View style={styles.pnlCol}>
              <Text
                style={[
                  styles.pnl,
                  {
                    color:
                      item.netPnL > 0
                        ? theme.success
                        : item.netPnL < 0
                        ? theme.error
                        : theme.textSecondary,
                  },
                ]}
              >
                {item.netPnL >= 0 ? "+" : ""}
                {formatCurrency(item.netPnL)}
              </Text>
            </View>
          </Pressable>
        );
      }}
      contentContainerStyle={[
        styles.list,
        leaderboard.length === 0 && styles.emptyList,
      ]}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={loadLeaderboard}
          tintColor={theme.text}
        />
      }
      ListHeaderComponent={
        leaderboard.length > 0 ? (
          <View style={styles.headerRow}>
            <Text style={[styles.headerLabel, { color: theme.textSecondary }]}>RANK</Text>
            <Text style={[styles.headerLabel, styles.headerUser, { color: theme.textSecondary }]}>MEMBER</Text>
            <Text style={[styles.headerLabel, { color: theme.textSecondary }]}>P&L</Text>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <IconSymbol name="trophy.fill" size={40} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            No Rankings Yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Rankings appear after predictions are resolved
          </Text>
        </View>
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyList: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 8,
    marginBottom: 4,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  headerUser: {
    flex: 1,
    marginLeft: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rankCol: {
    width: 36,
    alignItems: "center",
  },
  medal: {
    fontSize: 20,
  },
  rankNum: {
    fontSize: 16,
    fontWeight: '400',
  },
  userCol: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  username: {
    fontSize: 15,
    fontWeight: '400',
  },
  statsLine: {
    fontSize: 12,
    marginTop: 2,
  },
  pnlCol: {
    alignItems: "flex-end",
    minWidth: 70,
  },
  pnl: {
    fontSize: 16,
    fontWeight: '400',
  },
  emptyState: {
    alignItems: "center",
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '400',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
  },
});
