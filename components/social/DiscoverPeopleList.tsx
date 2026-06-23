import { AuraBadge } from "@/components/profile/AuraBadge";
import { UserAvatar } from "@/components/social/UserAvatar";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    View,
} from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppText } from "@/components/ui/AppText";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { DiscoverableUser, socialService } from "@/services/social.service";

interface DiscoverPeopleListProps {
  embedded?: boolean;
  scrollEnabled?: boolean;
  pageSize?: number;
  showHeader?: boolean;
  showSeeAll?: boolean;
  onSeeAll?: () => void;
  onFollowChange?: () => void;
  suggestedFirst?: boolean;
  users?: DiscoverableUser[];
}

export function DiscoverPeopleList({
  embedded = false,
  scrollEnabled = true,
  pageSize = 30,
  showHeader = true,
  showSeeAll = false,
  onSeeAll,
  onFollowChange,
  suggestedFirst = false,
  users: usersOverride,
}: DiscoverPeopleListProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const { user } = useAuthContext();
  const { t } = useTranslation("social");

  const [members, setMembers] = useState<DiscoverableUser[]>([]);
  const [suggested, setSuggested] = useState<DiscoverableUser[]>([]);
  const [loading, setLoading] = useState(!usersOverride);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  const load = useCallback(
    async (offset = 0, append = false) => {
      const data = await socialService.listDiscoverableUsers(pageSize, offset);
      setHasMore(data.length === pageSize);

      const followState: Record<string, boolean> = {};
      for (const row of data) {
        followState[row.user_id] = row.is_following;
      }

      setFollowingMap((prev) => (append ? { ...prev, ...followState } : followState));
      setMembers((prev) => (append ? [...prev, ...data] : data));
      setLoading(false);
      setLoadingMore(false);
    },
    [pageSize],
  );

  useEffect(() => {
    if (usersOverride) {
      setMembers(usersOverride);
      const followState: Record<string, boolean> = {};
      for (const row of usersOverride) {
        followState[row.user_id] = row.is_following;
      }
      setFollowingMap(followState);
      setLoading(false);
      return;
    }
    setLoading(true);
    load(0, false);
  }, [load, usersOverride]);

  useEffect(() => {
    if (!suggestedFirst || usersOverride) return;
    socialService.getSuggestedUsers(8).then(setSuggested);
  }, [suggestedFirst, usersOverride]);

  const onEndReached = useCallback(async () => {
    if (usersOverride || loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    await load(members.length, true);
  }, [hasMore, load, loading, loadingMore, members.length, usersOverride]);

  const toggleFollow = async (targetId: string) => {
    setFollowingMap((prev) => ({ ...prev, [targetId]: !prev[targetId] }));
    const { isFollowing, error } = await socialService.toggleFollow(targetId);
    if (error) {
      setFollowingMap((prev) => ({ ...prev, [targetId]: !prev[targetId] }));
      return;
    }
    setFollowingMap((prev) => ({ ...prev, [targetId]: isFollowing }));
    onFollowChange?.();
  };

  const formatSubtitle = (item: DiscoverableUser) => {
    if (item.total_bets > 0) {
      return t("discoverMemberBets", { count: item.total_bets });
    }
    return t("discoverJoined", {
      date: new Date(item.created_at).toLocaleDateString(),
    });
  };

  const renderUser = ({ item }: { item: DiscoverableUser }) => {
    const isFollowing = followingMap[item.user_id] ?? false;

    return (
      <View
        style={[
          styles.userRow,
          embedded && styles.userRowEmbedded,
          { borderBottomColor: theme.border },
        ]}
      >
        <Pressable
          style={styles.userMain}
          onPress={() => router.push(`/profile/${item.user_id}` as any)}
          accessibilityRole="button"
          accessibilityLabel={t("viewProfile", { username: item.username })}
        >
          <UserAvatar uri={item.avatar_url} username={item.username} size={embedded ? 44 : 48} />
          <View style={styles.userInfo}>
            <View style={styles.nameRow}>
              <AppText variant="body" style={styles.username}>
                @{item.username}
              </AppText>
              {item.win_rate != null ? <AuraBadge winRate={item.win_rate} compact /> : null}
            </View>
            <AppText variant="caption" color="secondary">
              {formatSubtitle(item)}
            </AppText>
          </View>
        </Pressable>

        {user && user.id !== item.user_id ? (
          <AppButton
            title={isFollowing ? t("following") : t("follow")}
            variant={isFollowing ? "secondary" : "primary"}
            size="sm"
            onPress={() => toggleFollow(item.user_id)}
          />
        ) : null}
      </View>
    );
  };

  const listData = usersOverride ?? members;

  if (loading && listData.length === 0) {
    return (
      <View style={[styles.center, embedded && styles.centerEmbedded]} accessibilityLabel={t("loading")}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (listData.length === 0 && suggested.length === 0) {
    return (
      <EmptyState
        icon="people-outline"
        title={t("discoverEmptySuggested")}
        description={t("discoverHelper")}
      />
    );
  }

  return (
    <View style={embedded ? styles.embeddedWrap : styles.fullWrap}>
      {suggestedFirst && suggested.length > 0 && !usersOverride ? (
        <>
          <AppText variant="caption" color="secondary" style={styles.sectionLabel}>
            {t("discoverSuggested")}
          </AppText>
          {suggested.map((item) => (
            <View key={`suggested-${item.user_id}`}>{renderUser({ item })}</View>
          ))}
        </>
      ) : null}

      {showHeader ? (
        <AppText variant="caption" color="secondary" style={styles.sectionLabel}>
          {t("discoverAllMembers")}
        </AppText>
      ) : null}

      <FlatList
        data={listData}
        keyExtractor={(item) => item.user_id}
        renderItem={renderUser}
        scrollEnabled={scrollEnabled}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        contentContainerStyle={embedded ? styles.embeddedList : undefined}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : showSeeAll && hasMore && !usersOverride ? (
            <AppButton
              title={t("discoverSeeAll")}
              variant="secondary"
              size="sm"
              onPress={onSeeAll}
              style={styles.seeAllButton}
            />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fullWrap: { flex: 1 },
  embeddedWrap: { flex: 1, minHeight: 120 },
  embeddedList: { paddingBottom: 8 },
  sectionLabel: {
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  userRowEmbedded: {
    paddingVertical: 10,
  },
  userMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
  },
  userInfo: { flex: 1, gap: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  username: { fontWeight: "600" },
  center: { padding: 24, alignItems: "center" },
  centerEmbedded: { paddingVertical: 16 },
  seeAllButton: { marginTop: 8, marginBottom: 8, alignSelf: "center" },
});
