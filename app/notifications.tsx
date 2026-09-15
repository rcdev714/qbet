import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    View,
} from "react-native";

import { WebContentColumn } from "@/components/layout/WebContentColumn";
import { NotificationRow } from "@/components/notifications/NotificationRow";
import { EmptyState } from "@/components/ui";
import { AppText } from "@/components/ui/AppText";
import { FilterChipBar } from "@/components/ui/FilterChipBar";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { useTheme } from "@/contexts/ThemeContext";
import { useGroupNavigation } from "@/hooks/useGroupNavigation";
import { useNotifications } from "@/hooks/useNotifications";
import { Notification } from "@/services/notification.service";

type NotificationFilter = "all" | "results" | "social" | "groups";

const FILTER_TYPES: Record<Exclude<NotificationFilter, "all">, string[]> = {
  results: ["bet_won", "bet_lost", "market_resolved"],
  social: ["new_follower"],
  groups: ["group_invite", "group_invite_accepted"],
};

function getNotificationRoute(notification: Notification): string | null {
  const data = notification.data ?? {};

  switch (notification.type) {
    case "bet_won":
    case "bet_lost":
    case "market_resolved":
      return data.market_id ? `/market/${data.market_id}` : null;
    case "new_follower":
      return data.follower_id ? `/profile/${data.follower_id}` : null;
    case "group_invite":
    case "group_invite_accepted":
      return data.group_id ? `/group/${data.group_id}` : null;
    case "beta_approved":
      return "/";
    default:
      return null;
  }
}

function filterNotifications(items: Notification[], filter: NotificationFilter): Notification[] {
  if (filter === "all") return items;
  const types = FILTER_TYPES[filter];
  return items.filter((n) => types.includes(n.type));
}

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { openGroup } = useGroupNavigation();
  const { t } = useTranslation("social");
  const { notifications, loading, refresh, markAsRead, markAllAsRead, unreadCount } =
    useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("all");

  const filtered = useMemo(
    () => filterNotifications(notifications, filter),
    [notifications, filter],
  );

  const filterOptions = useMemo(
    () =>
      (
        [
          { key: "all", label: t("filterAll"), hintKey: "filterAllHint" },
          { key: "results", label: t("filterResults"), hintKey: "filterResultsHint" },
          { key: "social", label: t("filterSocial"), hintKey: "filterSocialHint" },
          { key: "groups", label: t("filterGroups"), hintKey: "filterGroupsHint" },
        ] as const
      ).map((item) => ({
        key: item.key,
        label: item.label,
        accessibilityHint: t(item.hintKey),
      })),
    [t],
  );

  const emptyCopy: Record<NotificationFilter, { title: string; description: string }> = {
    all: {
      title: t("notificationsEmptyTitle"),
      description: t("notificationsEmptyDescription"),
    },
    results: {
      title: t("notificationsEmptyResultsTitle"),
      description: t("notificationsEmptyResultsDescription"),
    },
    social: {
      title: t("notificationsEmptySocialTitle"),
      description: t("notificationsEmptySocialDescription"),
    },
    groups: {
      title: t("notificationsEmptyGroupsTitle"),
      description: t("notificationsEmptyGroupsDescription"),
    },
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handlePress = useCallback(
    async (notification: Notification) => {
      if (!notification.read_at) {
        await markAsRead(notification.id);
      }
      const data = notification.data ?? {};
      if (
        (notification.type === "group_invite" || notification.type === "group_invite_accepted") &&
        data.group_id
      ) {
        openGroup(String(data.group_id));
        return;
      }
      const route = getNotificationRoute(notification);
      if (route) router.push(route as any);
    },
    [markAsRead, openGroup, router],
  );

  const handleOpenSettings = useCallback(() => {
    router.push("/settings/notifications" as any);
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title={t("notificationsTitle")}
        showBack
        right={
          unreadCount > 0 ? (
            <Pressable
              onPress={markAllAsRead}
              accessibilityRole="button"
              accessibilityLabel={t("markAllReadHint")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.markAllButton}>
              <AppText variant="caption" color="primary" numberOfLines={1}>
                {t("markAllRead")}
              </AppText>
            </Pressable>
          ) : (
            <View style={{ width: 24 }} />
          )
        }
      />

      <WebContentColumn variant="social" style={styles.contentColumn}>
      <FilterChipBar
        options={filterOptions}
        value={filter}
        onChange={setFilter}
        accessibilityLabel={t("notificationFiltersLabel")}
      />

      {loading && notifications.length === 0 ? (
        <View style={styles.center} accessibilityLabel={t("loading")}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.primary}
            />
          }
          contentContainerStyle={filtered.length === 0 ? styles.emptyList : undefined}
          renderItem={({ item }) => (
            <NotificationRow
              notification={item}
              theme={theme}
              onPress={() => handlePress(item)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title={emptyCopy[filter].title}
              description={emptyCopy[filter].description}
              actionLabel={t("openNotificationSettings")}
              onAction={handleOpenSettings}
            />
          }
        />
      )}
      </WebContentColumn>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentColumn: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyList: {
    flexGrow: 1,
  },
  markAllButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingLeft: 8,
  },
});
