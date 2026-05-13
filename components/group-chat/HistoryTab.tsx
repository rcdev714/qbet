import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/ThemeContext";
import type { Market } from "@/types/market";
import { useRouter } from "expo-router";
import React from "react";
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

interface HistoryTabProps {
  markets: Market[];
  loading: boolean;
  onRefresh: () => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function HistoryTab({ markets, loading, onRefresh }: HistoryTabProps) {
  const { theme, isDark } = useTheme();
  const router = useRouter();

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
        <TouchableOpacity
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
          onPress={() => router.push(`/market/${item.id}` as any)}
          activeOpacity={0.7}
        >
          <View style={styles.cardTop}>
            <Text style={[styles.question, { color: theme.text }]} numberOfLines={2}>
              {item.question}
            </Text>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: item.status === "resolved"
                    ? (isDark ? "rgba(52,199,89,0.15)" : "#E8FAF0")
                    : (isDark ? "rgba(142,142,147,0.15)" : "#F2F2F7"),
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color: item.status === "resolved" ? "#34C759" : theme.textSecondary,
                  },
                ]}
              >
                {(item.status || "closed").toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={styles.cardBottom}>
            <Text style={[styles.dateText, { color: theme.textSecondary }]}>
              {formatDate(item.closes_at)}
            </Text>
            <IconSymbol name="chevron.right" size={14} color={theme.textSecondary} />
          </View>
        </TouchableOpacity>
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
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <IconSymbol name="clock.fill" size={40} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            No History Yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Resolved predictions will appear here
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
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  question: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    lineHeight: 22,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  dateText: {
    fontSize: 13,
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
