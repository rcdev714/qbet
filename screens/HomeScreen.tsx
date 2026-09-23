import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";

import { CreateGroupSheet } from "@/components/groups/CreateGroupSheet";
import { HomeGroupListRow } from "@/components/groups/HomeGroupListRow";
import { JoinGroupSheet } from "@/components/groups/JoinGroupSheet";
import {
  AppIconButton,
  AppScreen,
  AppText,
  EmptyState,
} from "@/components/ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useGroupNavigation } from "@/hooks/useGroupNavigation";
import { useGroups } from "@/hooks/useGroups";
import { betService } from "@/services/bet.service";
import { messageService } from "@/services/message.service";
import { walletService } from "@/services/wallet.service";
import type { GroupSummary } from "@/types/group";
import type { Message } from "@/types/message";

const getNumericValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

function StatPill({
  label,
  value,
  borderColor,
  backgroundColor,
  valueColor,
}: {
  label: string;
  value: string;
  borderColor: string;
  backgroundColor?: string;
  valueColor?: string;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.statPill,
        {
          borderColor,
          backgroundColor: backgroundColor ?? "transparent",
          borderRadius: theme.radius.lg,
        },
      ]}
    >
      <AppText variant="caption" color="secondary" style={styles.statLabelUpper}>
        {label}
      </AppText>
      <AppText variant="label" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </AppText>
    </View>
  );
}

export function HomeScreen() {
  const { t } = useTranslation("groups");
  const { openGroup } = useGroupNavigation();
  const { groups, loading: groupsLoading, refresh } = useGroups();
  const { user } = useAuthContext();
  const { theme, isDark } = useTheme();
  const [lastMessages, setLastMessages] = useState<Record<string, Message | null>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [betStats, setBetStats] = useState({
    totalBets: 0,
    gained: 0,
    loss: 0,
    activeBets: 0,
    closedBets: 0,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const prevGroupIdsRef = useRef<string>("");

  const handleCreated = (group: GroupSummary) => {
    setCreateOpen(false);
    void refresh();
    openGroup(group.id, { message: t("opening") });
  };

  const handleJoined = (groupId: string) => {
    setJoinOpen(false);
    void refresh();
    openGroup(groupId, { message: t("opening") });
  };

  useEffect(() => {
    if (!user || groups.length === 0) return;

    const currentGroupIds = groups.map((g) => g.id).sort().join(",");
    if (currentGroupIds === prevGroupIdsRef.current) return;
    prevGroupIdsRef.current = currentGroupIds;

    const fetchLastMessages = async () => {
      const messages: Record<string, Message | null> = {};
      const counts: Record<string, number> = {};

      for (const group of groups) {
        messages[group.id] = await messageService.getLastMessage(group.id);
        counts[group.id] = await messageService.getUnreadCount(group.id, user.id);
      }

      setLastMessages(messages);
      setUnreadCounts(counts);
    };

    void fetchLastMessages();
  }, [groups, user]);

  const totalUnread = useMemo(
    () => Object.values(unreadCounts).reduce((sum, count) => sum + count, 0),
    [unreadCounts],
  );

  const fetchBetStats = useCallback(async () => {
    if (!user?.id) return;

    try {
      const [betSummary, transactions] = await Promise.all([
        betService.getUserBetSummary(user.id),
        walletService.getTransactions(user.id),
      ]);

      const completedTransactions = transactions.filter((tx) => !tx.status || tx.status === "completed");

      const gained = completedTransactions
        .filter((tx) => tx.type === "bet_won")
        .reduce((sum, tx) => sum + getNumericValue(tx.amount), 0);

      const placedLoss = completedTransactions
        .filter((tx) => tx.type === "bet_placed")
        .reduce((sum, tx) => sum + Math.abs(getNumericValue(tx.amount)), 0);

      const refundedLoss = completedTransactions
        .filter((tx) => tx.type === "bet_refund")
        .reduce((sum, tx) => sum + getNumericValue(tx.amount), 0);

      setBetStats({
        totalBets: betSummary.totalBets,
        activeBets: betSummary.activeBets,
        closedBets: betSummary.closedBets,
        gained,
        loss: Math.max(0, placedLoss - refundedLoss),
      });
    } catch (error) {
      console.error("Error fetching bet stats:", error);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchBetStats();
  }, [fetchBetStats]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      refresh();
      void fetchBetStats();
    }, [user, refresh, fetchBetStats]),
  );

  const renderGroup = ({ item }: { item: GroupSummary }) => (
    <HomeGroupListRow
      group={item}
      lastMessage={lastMessages[item.id]}
      unreadCount={unreadCounts[item.id] || 0}
      currentUserId={user?.id}
    />
  );

  if (groupsLoading) {
    return (
      <AppScreen padBottomForTabBar style={styles.centered}>
        <ActivityIndicator size="large" color={theme.primary} />
      </AppScreen>
    );
  }

  return (
    <AppScreen padBottomForTabBar style={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <View style={[styles.header, { paddingHorizontal: theme.spacing.lg }]}>
        <View style={styles.headerLeft}>
          <AppText variant="title3">Groups</AppText>
          <AppText variant="caption" color="secondary">
            Social + markets
          </AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statRow}
            style={styles.statsWheel}
          >
            <StatPill
              label="Gained"
              value={`$${betStats.gained.toFixed(2)}`}
              borderColor={theme.primary}
              backgroundColor={`${theme.primary}15`}
              valueColor={theme.primary}
            />
            <StatPill
              label="Loss"
              value={`$${betStats.loss.toFixed(2)}`}
              borderColor={theme.error}
              backgroundColor={`${theme.error}15`}
              valueColor={theme.error}
            />
            <StatPill label="Total Bets" value={String(betStats.totalBets)} borderColor={theme.border} />
            <StatPill label="Groups" value={String(groups.length)} borderColor={theme.border} />
            <StatPill label="Unread" value={String(totalUnread)} borderColor={theme.border} />
            <StatPill label="Active Bets" value={String(betStats.activeBets)} borderColor={theme.border} />
            <StatPill label="Closed Bets" value={String(betStats.closedBets)} borderColor={theme.border} />
          </ScrollView>
        </View>
        <View style={styles.headerButtons}>
          <AppIconButton
            icon={<IconSymbol name="link" size={24} color={theme.text} />}
            accessibilityLabel={t("joinWithCode")}
            onPress={() => setJoinOpen(true)}
            style={{ marginRight: 8 }}
          />
          <AppIconButton
            icon={<IconSymbol name="plus" size={24} color={theme.text} />}
            accessibilityLabel={t("createSheetTitle")}
            onPress={() => setCreateOpen(true)}
          />
        </View>
      </View>

      {groups.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="people-outline"
            title="No groups yet"
            description="Start a prediction group with your friends"
            actionLabel={t("joinWithCode")}
            onAction={() => setJoinOpen(true)}
            secondaryActionLabel={t("createSheetTitle")}
            onSecondaryAction={() => setCreateOpen(true)}
          />
        </View>
      ) : (
        <FlatList
          data={groups}
          renderItem={renderGroup}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => (
            <View style={[styles.groupSeparator, { backgroundColor: theme.border }]} />
          )}
        />
      )}

      <CreateGroupSheet visible={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
      <JoinGroupSheet visible={joinOpen} onClose={() => setJoinOpen(false)} onJoined={handleJoined} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
    gap: 4,
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  statsWheel: {
    maxHeight: 48,
    marginTop: 8,
  },
  statRow: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 20,
    paddingVertical: 4,
  },
  statPill: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 75,
    minHeight: 32,
  },
  statLabelUpper: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  list: {
    paddingBottom: 40,
  },
  groupSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 80,
  },
  emptyWrap: {
    flex: 1,
  },
});
