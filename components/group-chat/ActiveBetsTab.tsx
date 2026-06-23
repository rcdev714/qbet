import { MarketCard } from "@/components/MarketCard";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/ThemeContext";
import { useMarket } from "@/hooks/useMarket";
import type { Market } from "@/types/market";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from "react-native";

interface ActiveBetsTabProps {
  markets: Market[];
  loading: boolean;
  isAdmin: boolean;
  currentUserId?: string;
  onBet: (market: Market, optionId: string, side: "yes" | "no") => void;
  onResolve: (marketId: string, optionId: string) => void;
  onRefresh: () => void;
  refreshTrigger?: number;
}

/** Renders a single market with live hook data */
function ActiveMarketItem({
  market,
  isAdmin,
  currentUserId,
  onBet,
  onResolve,
  refreshTrigger,
}: {
  market: Market;
  isAdmin: boolean;
  currentUserId?: string;
  onBet: (market: Market, optionId: string, side: "yes" | "no") => void;
  onResolve: (marketId: string, optionId: string) => void;
  refreshTrigger?: number;
}) {
  const router = useRouter();
  const { market: liveMarket, options, loading, refresh } = useMarket(market.id);

  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) refresh();
  }, [refreshTrigger, refresh]);

  if (loading) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator size="small" color="#999" />
      </View>
    );
  }

  if (!liveMarket) {
    return (
      <View style={styles.errorCard}>
        <Text style={styles.errorCardText}>Could not load this prediction.</Text>
      </View>
    );
  }

  const isCreator = currentUserId ? liveMarket.creator_id === currentUserId : false;
  const canResolve = isAdmin || isCreator;

  return (
    <View style={styles.cardWrapper}>
      <MarketCard
        market={liveMarket}
        options={options}
        onSelectOption={(optionId, side) => onBet(liveMarket, optionId, side)}
        onResolve={(optionId) => onResolve(liveMarket.id, optionId)}
        onViewDistribution={() => router.push(`/bet/${liveMarket.id}` as any)}
        canResolve={canResolve}
      />
    </View>
  );
}

export function ActiveBetsTab({
  markets,
  loading,
  isAdmin,
  currentUserId,
  onBet,
  onResolve,
  onRefresh,
  refreshTrigger,
}: ActiveBetsTabProps) {
  const { theme } = useTheme();

  if (loading && markets.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={markets}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ActiveMarketItem
          market={item}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          onBet={onBet}
          onResolve={onResolve}
          refreshTrigger={refreshTrigger}
        />
      )}
      contentContainerStyle={[
        styles.list,
        markets.length === 0 && styles.emptyList,
      ]}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={onRefresh}
          tintColor={theme.text}
        />
      }
      ListHeaderComponent={
        markets.length > 0 ? (
          <View style={styles.listHeader}>
            <View>
              <Text style={[styles.listTitle, { color: theme.text }]}>Open predictions</Text>
              <Text style={[styles.listSubtitle, { color: theme.textSecondary }]}>
                Pick a side, review the price, and place your bet.
              </Text>
            </View>
            <View style={[styles.countPill, { backgroundColor: `${theme.primary}18` }]}>
              <Text style={[styles.countPillText, { color: theme.primary }]}>{markets.length}</Text>
            </View>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <IconSymbol name="chart.bar.fill" size={40} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            No Active Predictions
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Use Create prediction in the header to start one.
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
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 40,
  },
  emptyList: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cardWrapper: {
    marginBottom: 18,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 16,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: -0.4,
  },
  listSubtitle: {
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  countPill: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  countPillText: {
    fontSize: 14,
    fontWeight: "600",
  },
  loadingCard: {
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: "rgba(0,0,0,0.03)",
  },
  errorCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  errorCardText: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  emptySubtitle: {
    fontSize: 14,
  },
});
