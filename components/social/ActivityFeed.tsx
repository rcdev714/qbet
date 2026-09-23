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
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useAuthContext } from "@/contexts/AuthContext";
import { useSocialFollow } from "@/contexts/SocialFollowContext";
import { useTheme } from "@/contexts/ThemeContext";
import { resolveSocialFeedMode, type SocialFeedRequest } from "@/lib/social/feed-visibility";
import { FollowingActivity, socialService } from "@/services/social.service";

const PAGE_SIZE = 30;

interface ActivityFeedProps {
  mode?: SocialFeedRequest;
  /** Profile timeline. Ignores Discover / Following and does not suggest people. */
  profileUserId?: string;
  scrollEnabled?: boolean;
  /** When "none", discover suggestions are handled elsewhere (for example the desktop sidebar). */
  discoverPlacement?: "inline" | "none";
  onBrowseDiscover?: () => void;
}

export function ActivityFeed({
  mode = "auto",
  profileUserId,
  scrollEnabled = true,
  discoverPlacement = "inline",
  onBrowseDiscover,
}: ActivityFeedProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const { user } = useAuthContext();
  const { followingCount, subscribeActivityRefresh, refreshFollowingCount } = useSocialFollow();
  const { t } = useTranslation("social");
  const [items, setItems] = useState<FollowingActivity[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coercedFromFollowing, setCoercedFromFollowing] = useState(false);
  const [resolvedMode, setResolvedMode] = useState<"discover" | "following">("discover");

  const load = useCallback(
    async (offset = 0, append = false) => {
      if (!user) {
        setItems([]);
        setHasMore(false);
        setError(null);
        setInitialLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        return;
      }

      if (profileUserId) {
        const result = await socialService.getProfileActivity(profileUserId, PAGE_SIZE, offset);
        setResolvedMode("discover");
        setCoercedFromFollowing(false);
        setError(result.error ? t("feedLoadError") : null);
        setHasMore(!result.error && result.items.length === PAGE_SIZE);
        setItems((prev) => (append ? [...prev, ...result.items] : result.items));
        setInitialLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        return;
      }

      const resolved = resolveSocialFeedMode({ requested: mode, followingCount });
      setResolvedMode(resolved.mode);
      setCoercedFromFollowing(resolved.coercedFromFollowing);
      const result = await socialService.getSocialFeed(resolved.mode, PAGE_SIZE, offset);
      setError(result.error ? t("feedLoadError") : null);
      setHasMore(!result.error && result.items.length === PAGE_SIZE);
      setItems((prev) => (append ? [...prev, ...result.items] : result.items));
      setInitialLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    },
    [followingCount, mode, profileUserId, t, user],
  );

  useEffect(() => {
    void load(0, false);
  }, [load]);

  useEffect(() => {
    return subscribeActivityRefresh(() => {
      void load(0, false);
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
    !profileUserId &&
    discoverPlacement === "inline" &&
    resolvedMode === "discover" &&
    items.length === 0 &&
    !error;

  const listHeader = coercedFromFollowing ? (
    <View style={styles.note}>
      <AppText variant="bodySm" color="secondary">
        {t("feedNoFollowsNote")}
      </AppText>
    </View>
  ) : resolvedMode === "discover" && !profileUserId ? (
    <View style={styles.note}>
      <AppText variant="caption" color="secondary">
        {t("feedDiscoverNote")}
      </AppText>
    </View>
  ) : null;

  if (!user) {
    return (
      <View style={styles.emptyWrap}>
        <EmptyState
          icon="people-outline"
          title={t("followingSignInTitle")}
          description={t("followingSignInDescription")}
          actionLabel={t("followingSignInAction")}
          onAction={() => router.push("/login" as never)}
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

  const emptyFollowing = (
    <View style={styles.caughtUpEmpty}>
      <AppText variant="title3" style={styles.caughtUpTitle}>
        {t("feedFollowingPrivate")}
      </AppText>
      <AppText variant="bodySm" color="secondary" style={styles.caughtUpText}>
        {t("activityFollowingEmpty")}
      </AppText>
      <AppButton
        title={t("feedFollowingPrivateAction")}
        variant="secondary"
        size="sm"
        onPress={onBrowseDiscover ?? (() => router.push("/discover" as never))}
        style={styles.emptyAction}
      />
    </View>
  );

  const body = items.length === 0 && !showInlineDiscover ? (
    <View style={styles.emptyWrap}>
      {error ? <ErrorBanner message={error} onRetry={() => void load(0, false)} /> : null}
      {profileUserId ? (
        <EmptyState
          icon="layers-outline"
          title={t("profileActivityEmptyTitle")}
          description={t("profileActivityEmptyDescription")}
        />
      ) : resolvedMode === "following" ? (
        emptyFollowing
      ) : (
        <EmptyState
          icon="people-outline"
          title={t("activityEmpty")}
          description={t("discoverHelper")}
          actionLabel={t("openDiscover")}
          onAction={() => router.push("/discover" as never)}
        />
      )}
    </View>
  ) : scrollEnabled ? (
    <View style={styles.full} accessibilityLabel={t(resolvedMode === "following" ? "activitySection" : "feedDiscoverNote")}>
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.activity_type}-${item.activity_id}`}
        scrollEnabled
        onEndReached={() => void onEndReached()}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={theme.primary} />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {listHeader}
            {error ? <ErrorBanner message={error} onRetry={() => void load(0, false)} /> : null}
            {showInlineDiscover ? (
              <View style={styles.discoverBlock}>
                <DiscoverPeopleList
                  variant="cards"
                  embedded
                  scrollEnabled={false}
                  showHeader={false}
                  suggestedFirst
                />
              </View>
            ) : null}
          </>
        }
        renderItem={({ item }) => <ActivityFeedRow item={item} />}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : !hasMore && items.length > 0 ? (
            <View style={styles.caughtUp}>
              <AppText variant="bodySm" color="secondary" style={styles.caughtUpText}>
                {t("activityCaughtUp")}
              </AppText>
            </View>
          ) : null
        }
      />
    </View>
  ) : (
    <View accessibilityLabel={t("tabActivity")}>
      {listHeader}
      {error ? <ErrorBanner message={error} onRetry={() => void load(0, false)} /> : null}
      {items.map((item) => (
        <ActivityFeedRow key={`${item.activity_type}-${item.activity_id}`} item={item} />
      ))}
      {hasMore ? (
        <AppButton
          title={t("loadMore")}
          variant="secondary"
          size="sm"
          loading={loadingMore}
          onPress={() => void onEndReached()}
          style={styles.loadMore}
        />
      ) : null}
    </View>
  );

  return body;
}

const styles = StyleSheet.create({
  full: { flex: 1 },
  listContent: { paddingBottom: 24 },
  center: { padding: 24, alignItems: "center" },
  emptyWrap: {
    paddingVertical: 8,
    gap: 12,
    alignItems: "stretch",
    flex: 1,
  },
  emptyAction: { alignSelf: "center" },
  caughtUpEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
    gap: 10,
  },
  caughtUpTitle: { textAlign: "center" },
  caughtUp: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  caughtUpText: { textAlign: "center" },
  note: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  discoverBlock: { paddingBottom: 8 },
  loadMore: { margin: 16 },
});
