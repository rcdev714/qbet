import { ActivityFeedRow } from "@/components/social/ActivityFeedRow";
import { DiscoverPeopleList } from "@/components/social/DiscoverPeopleList";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    View,
} from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppText } from "@/components/ui/AppText";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { FollowingActivity, socialService } from "@/services/social.service";

const PAGE_SIZE = 30;

interface ActivityFeedProps {
  scrollEnabled?: boolean;
  embedded?: boolean;
}

export function ActivityFeed({ scrollEnabled = true, embedded = false }: ActivityFeedProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const { user } = useAuthContext();
  const { t } = useTranslation("social");
  const [items, setItems] = useState<FollowingActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async (offset = 0, append = false) => {
    if (!user) {
      setItems([]);
      setHasMore(false);
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
      return;
    }
    const data = await socialService.getFollowingActivity(PAGE_SIZE, offset);
    setHasMore(data.length === PAGE_SIZE);
    setItems((prev) => (append ? [...prev, ...data] : data));
    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    load(0, false);
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(0, false);
  }, [load]);

  const onEndReached = useCallback(async () => {
    if (loadingMore || !hasMore || loading || !user) return;
    setLoadingMore(true);
    await load(items.length, true);
  }, [hasMore, items.length, load, loading, loadingMore, user]);

  const handleFollowChange = useCallback(async () => {
    setLoading(true);
    await load(0, false);
  }, [load]);

  if (!user) {
    return (
      <View style={[styles.emptyWrap, embedded && styles.emptyEmbedded]}>
        <EmptyState
          icon="people-outline"
          title={t("followingSignInTitle")}
          description={t("followingSignInDescription")}
          actionLabel={t("followingSignInAction")}
          onAction={() => router.push("/login" as any)}
        />
      </View>
    );
  }

  if (loading && items.length === 0) {
    return (
      <View style={styles.center} accessibilityLabel={t("loading")}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={[styles.emptyWrap, embedded && styles.emptyEmbedded]}>
        <AppText variant="bodySm" color="secondary" style={styles.emptyText}>
          {t("activityEmpty")}
        </AppText>
        <DiscoverPeopleList
          embedded
          scrollEnabled={scrollEnabled}
          showHeader={false}
          showSeeAll
          onSeeAll={() => router.push("/discover" as any)}
          onFollowChange={handleFollowChange}
          suggestedFirst
        />
        <AppButton
          title={t("activityEmptyAction")}
          variant="secondary"
          size="sm"
          onPress={() => router.push("/discover" as any)}
          style={styles.emptyAction}
        />
      </View>
    );
  }

  return (
    <View
      style={embedded ? styles.embedded : styles.full}
      accessibilityRole="list"
      accessibilityLabel={t("activitySection")}
    >
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.activity_type}-${item.activity_id}`}
        scrollEnabled={scrollEnabled}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={
          scrollEnabled ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          ) : undefined
        }
        contentContainerStyle={embedded ? styles.embeddedList : styles.listContent}
        renderItem={({ item }) => <ActivityFeedRow item={item} />}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : !hasMore ? (
            <View style={styles.caughtUp}>
              <AppText variant="bodySm" color="secondary" style={styles.caughtUpText}>
                {t("activityCaughtUp")}
              </AppText>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1 },
  embedded: { flex: 1 },
  embeddedList: { paddingBottom: 24 },
  listContent: { paddingTop: 8, paddingBottom: 24 },
  center: { padding: 24, alignItems: "center" },
  emptyWrap: {
    paddingVertical: 8,
    gap: 12,
    alignItems: "stretch",
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyEmbedded: { paddingHorizontal: 0 },
  emptyText: { lineHeight: 20 },
  emptyAction: { alignSelf: "center" },
  caughtUp: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  caughtUpText: { textAlign: "center" },
});
