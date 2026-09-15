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
import { useSocialFollow } from "@/contexts/SocialFollowContext";
import { useTheme } from "@/contexts/ThemeContext";
import { FollowingActivity, socialService } from "@/services/social.service";

const PAGE_SIZE = 30;

interface ActivityFeedProps {
  scrollEnabled?: boolean;
  /** When "none", discover suggestions are handled elsewhere (e.g. desktop sidebar). */
  discoverPlacement?: "inline" | "none";
}

export function ActivityFeed({
  scrollEnabled = true,
  discoverPlacement = "inline",
}: ActivityFeedProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const { user } = useAuthContext();
  const { hasFollowing, subscribeActivityRefresh, refreshFollowingCount } = useSocialFollow();
  const { t } = useTranslation("social");
  const [items, setItems] = useState<FollowingActivity[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(
    async (offset = 0, append = false, options?: { silent?: boolean }) => {
      if (!user) {
        setItems([]);
        setHasMore(false);
        setInitialLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        return;
      }

      const data = await socialService.getFollowingActivity(PAGE_SIZE, offset);
      setHasMore(data.length === PAGE_SIZE);
      setItems((prev) => (append ? [...prev, ...data] : data));
      if (!options?.silent) {
        setInitialLoading(false);
      }
      setRefreshing(false);
      setLoadingMore(false);
    },
    [user],
  );

  const refreshFeed = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setInitialLoading(true);
      }
      await Promise.all([load(0, false, options), refreshFollowingCount()]);
    },
    [load, refreshFollowingCount],
  );

  useEffect(() => {
    void refreshFeed();
  }, [refreshFeed]);

  useEffect(() => {
    return subscribeActivityRefresh(() => {
      void load(0, false, { silent: true });
      void refreshFollowingCount();
    });
  }, [load, refreshFollowingCount, subscribeActivityRefresh]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(0, false);
    await refreshFollowingCount();
  }, [load, refreshFollowingCount]);

  const onEndReached = useCallback(async () => {
    if (loadingMore || !hasMore || initialLoading || !user) return;
    setLoadingMore(true);
    await load(items.length, true);
  }, [hasMore, initialLoading, items.length, load, loadingMore, user]);

  const showInlineDiscover =
    discoverPlacement === "inline" && !hasFollowing && items.length === 0;

  if (!user) {
    return (
      <View style={styles.emptyWrap}>
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

  if (initialLoading && items.length === 0) {
    return (
      <View style={styles.center} accessibilityLabel={t("loading")}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        {showInlineDiscover ? (
          <>
            <AppText variant="bodySm" color="secondary" style={styles.emptyText}>
              {t("activityEmpty")}
            </AppText>
            <DiscoverPeopleList
              variant="cards"
              embedded
              scrollEnabled={scrollEnabled}
              showHeader={false}
              suggestedFirst
            />
            <AppButton
              title={t("activityEmptyAction")}
              variant="secondary"
              size="sm"
              onPress={() => router.push("/discover" as any)}
              style={styles.emptyAction}
            />
          </>
        ) : (
          <View style={styles.caughtUpEmpty}>
            <AppText variant="title3" style={styles.caughtUpTitle}>
              {hasFollowing ? t("activityCaughtUp") : t("activityEmpty")}
            </AppText>
            <AppText variant="bodySm" color="secondary" style={styles.caughtUpText}>
              {hasFollowing ? t("activityFollowingEmpty") : t("discoverHelper")}
            </AppText>
            {!hasFollowing ? (
              <AppButton
                title={t("openDiscover")}
                variant="secondary"
                size="sm"
                onPress={() => router.push("/discover" as any)}
                style={styles.emptyAction}
              />
            ) : null}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.full} accessibilityRole="list" accessibilityLabel={t("activitySection")}>
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
        contentContainerStyle={styles.listContent}
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
  listContent: { paddingTop: 8, paddingBottom: 24 },
  center: { padding: 24, alignItems: "center" },
  emptyWrap: {
    paddingVertical: 8,
    gap: 12,
    alignItems: "stretch",
    flex: 1,
  },
  emptyText: { lineHeight: 20 },
  emptyAction: { alignSelf: "center" },
  caughtUpEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
    gap: 10,
  },
  caughtUpTitle: {
    textAlign: "center",
    fontWeight: "600",
  },
  caughtUp: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  caughtUpText: { textAlign: "center", lineHeight: 20 },
});
