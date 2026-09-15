import { buildTradingSummary, GroupListRow } from "@/components/groups/GroupListRow";
import { AppButton, AppText, StaggerGroup } from "@/components/ui";
import { DESKTOP_SPLIT_HEADER_HEIGHT } from "@/constants/layout";
import { Brand } from "@/constants/theme";
import { showAppAlertRaw } from "@/lib/ui/feedback";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    FlatList,
    Keyboard,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    TouchableOpacity,
    View
} from "react-native";
import { AnymarktLoader } from "../components/AnymarktLoader";
import { CreateGroupModal } from "../components/CreateGroupModal";
import { GlobalHeader } from "../components/GlobalHeader";
import { WebContentColumn } from "../components/layout/WebContentColumn";
import { NotificationBell } from "../components/notifications/NotificationBell";
import { CodeInput } from "../components/ui/CodeInput";
import { IconSymbol } from "../components/ui/icon-symbol";
import { useAuthContext } from "../contexts/AuthContext";
import { useIsDesktopWebNav } from "../contexts/NavigationLayoutContext";
import { useTheme } from "../contexts/ThemeContext";
import { useGroups } from "../hooks/useGroups";
import { useGroupNavigation } from "../hooks/useGroupNavigation";
import { usePremiumNavigation } from "../hooks/usePremiumNavigation";
import { betService } from "../services/bet.service";
import { groupService } from "../services/group.service";
import { messageService } from "../services/message.service";
import { walletService } from "../services/wallet.service";
import type { GroupSummary } from "../types/group";
import type { Message } from "../types/message";

const getNumericValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const ONBOARDING_STEPS = [
  ["1", "Create a group", "Start with friends, family, or a game-night crew."],
  ["2", "Ask a question", "Turn anything uncertain into outcomes people can pick."],
  ["3", "Place the first bet", "Seed the market so everyone knows how to join in."],
] as const;

const GROUP_ROW_HEIGHT = 74;
const GROUP_ICON_SIZE = 52;
const GROUP_TRADING_RAIL_WIDTH = 106;

const getGroupActivityTime = (
  group: GroupSummary,
  lastMessages: Record<string, Message | null>,
) => {
  const activityAt = lastMessages[group.id]?.created_at ?? group.created_at;
  const timestamp = activityAt ? new Date(activityAt).getTime() : 0;

  return Number.isFinite(timestamp) ? timestamp : 0;
};

type GroupMarketStats = {
  totalMarkets: number;
  activeMarkets: number;
  totalPool: number;
};

export type DirectMessagesScreenProps = {
  layout?: "standalone" | "list-pane";
  selectedGroupId?: string;
};

export function DirectMessagesScreen({
  layout = "standalone",
  selectedGroupId,
}: DirectMessagesScreenProps) {
  const router = useRouter();
  const { navigate } = usePremiumNavigation();
  const { openGroup } = useGroupNavigation();
  const isListPane = layout === "list-pane";
  const { groups, loading: groupsLoading, createGroup, joinGroup, refresh } = useGroups();
  const { user } = useAuthContext();
  const { theme, isDark } = useTheme();
  const isDesktopWebNav = useIsDesktopWebNav();
  const { t: tSocial } = useTranslation("social");
  const [lastMessages, setLastMessages] = useState<Record<string, Message | null>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [groupMarketStats, setGroupMarketStats] = useState<Record<string, GroupMarketStats>>({});
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [betStats, setBetStats] = useState({
    totalBets: 0,
    gained: 0,
    loss: 0,
    activeBets: 0,
    closedBets: 0,
  });

  // Group state
  const [isCreateModalVisible, setCreateModalVisible] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  
  // Separate state for the inline Join Code input
  const [joinCode, setJoinCode] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);

  const handleCreateGroup = async (name: string, description: string) => {
    const isFirstGroup = groups.length === 0;
    Keyboard.dismiss();
    setCreateLoading(true);
    try {
      const { group, error } = await createGroup(name, description);
      if (error) throw error;
      setCreateModalVisible(false);
      if (isFirstGroup && group?.id) {
        openGroup(group.id, { onboarding: "first-bet", message: "Opening your group..." });
      }
    } catch (error) {
       const errorMessage = error instanceof Error ? error.message : "An error occurred";
       showAppAlertRaw("Failed", errorMessage);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoinGroup = async (code: string) => {
    if (!code.trim()) {
      showAppAlertRaw("Error", "Please enter a valid code");
      return;
    }

    Keyboard.dismiss();
    setCreateLoading(true);
    try {
      const { error } = await joinGroup(code.toUpperCase());
      if (error) throw error;

      setCreateModalVisible(false);
      setJoinCode(""); // Reset inline join code if it was used there
      setShowJoinInput(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred";
      const message = errorMessage === 'Group not found'
        ? "Invalid code. Please check and try again."
        : errorMessage;
      showAppAlertRaw("Failed", message);
    } finally {
      setCreateLoading(false);
    }
  };

  const openModal = () => {
    setCreateModalVisible(true);
  };

  // Track group IDs to avoid refetching messages unnecessarily
  const prevGroupIdsRef = useRef<string>("");

  const fetchGroupSummaries = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    if (!user) return;
    if (groups.length === 0) {
      prevGroupIdsRef.current = "";
      setLastMessages({});
      setUnreadCounts({});
      setGroupMarketStats({});
      return;
    }

    const currentGroupIds = groups.map(g => g.id).sort().join(",");
    if (!force && currentGroupIds === prevGroupIdsRef.current) return;
    prevGroupIdsRef.current = currentGroupIds;

    try {
      setLoadingMessages(true);
      const messages: Record<string, Message | null> = {};
      const counts: Record<string, number> = {};
      const stats: Record<string, GroupMarketStats> = {};

      for (const group of groups) {
        const [lastMessage, marketStats, unreadCount] = await Promise.all([
          messageService.getLastMessage(group.id),
          groupService.getGroupMarketStats(group.id),
          messageService.getUnreadCount(group.id, user.id),
        ]);
        messages[group.id] = lastMessage;
        stats[group.id] = marketStats;
        counts[group.id] = unreadCount;
      }

      setLastMessages(messages);
      setUnreadCounts(counts);
      setGroupMarketStats(stats);
    } catch (error) {
      console.error("Error fetching group summaries:", error);
    } finally {
      setLoadingMessages(false);
    }
  }, [groups, user]);

  // Fetch last messages, unread counts, and market stats for all groups.
  useEffect(() => {
    fetchGroupSummaries();
  }, [fetchGroupSummaries]);

  const totalUnread = useMemo(() => {
    return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
  }, [unreadCounts]);

  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => {
      const activityDifference =
        getGroupActivityTime(b, lastMessages) - getGroupActivityTime(a, lastMessages);

      if (activityDifference !== 0) return activityDifference;
      return a.name.localeCompare(b.name);
    });
  }, [groups, lastMessages]);

  const fetchBetStats = useCallback(async () => {
    if (!user?.id) return;

    try {
      const [betSummary, transactions] = await Promise.all([
        betService.getUserBetSummary(user.id),
        walletService.getTransactions(user.id),
      ]);

      const completedTransactions = transactions.filter(
        (tx) => !tx.status || tx.status === "completed"
      );

      const gained = completedTransactions
        .filter((tx) => tx.type === "bet_won")
        .reduce((sum, tx) => sum + getNumericValue(tx.amount), 0);

      const placedLoss = completedTransactions
        .filter((tx) => tx.type === "bet_placed")
        .reduce((sum, tx) => sum + Math.abs(getNumericValue(tx.amount)), 0);

      const refundedLoss = completedTransactions
        .filter((tx) => tx.type === "bet_refund")
        .reduce((sum, tx) => sum + getNumericValue(tx.amount), 0);

      const loss = Math.max(0, placedLoss - refundedLoss);

      setBetStats({
        totalBets: betSummary.totalBets,
        activeBets: betSummary.activeBets,
        closedBets: betSummary.closedBets,
        gained,
        loss,
      });
    } catch (error) {
      console.error("Error fetching bet stats:", error);
    }
  }, [user?.id]);

  // Fetch bet statistics
  useEffect(() => {
    fetchBetStats();
  }, [fetchBetStats]);

  // Memoize refresh callback for useFocusEffect
  const handleFocusRefresh = useCallback(() => {
    if (!user) return;
    refresh();
    fetchBetStats();
    fetchGroupSummaries({ force: true });
  }, [user, refresh, fetchBetStats, fetchGroupSummaries]);

  useFocusEffect(
    useCallback(() => {
      handleFocusRefresh();
    }, [handleFocusRefresh])
  );

  const renderGroup = ({ item }: { item: GroupSummary }) => (
    <GroupListRow
      group={item}
      lastMessage={lastMessages[item.id]}
      unreadCount={unreadCounts[item.id] || 0}
      tradingSummary={buildTradingSummary(groupMarketStats[item.id])}
      selected={isListPane && selectedGroupId === item.id}
      currentUserId={user?.id}
      onPress={() => openGroup(item.id, { message: "Opening your group..." })}
    />
  );

  const listHeaderActions = (
    <View style={styles.headerButtons}>
      {!isListPane && !isDesktopWebNav ? <NotificationBell /> : null}
      {!isListPane && !isDesktopWebNav ? (
        <TouchableOpacity
          style={[styles.headerButton, { marginRight: 8 }]}
          onPress={() => router.push("/discover" as any)}
          accessibilityRole="button"
          accessibilityLabel={tSocial("openDiscover")}
        >
          <IconSymbol name="magnifyingglass" size={22} color={theme.text} />
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        style={[styles.headerButton, { marginRight: 8 }]}
        onPress={() => {
          setShowJoinInput(!showJoinInput);
        }}
        accessibilityRole="button"
        accessibilityLabel={tSocial("joinGroup")}
      >
        <IconSymbol name="link" size={24} color={theme.text} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.headerButton} onPress={() => openModal()}>
        <IconSymbol name="plus" size={24} color={theme.text} />
      </TouchableOpacity>
    </View>
  );

  const groupsListBody = groups.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.onboardingScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.onboardingCard, { backgroundColor: isDark ? "#101014" : theme.surface, borderColor: theme.border }]}>
            <View style={[styles.onboardingHeroIcon, { backgroundColor: `${theme.primary}18` }]}>
              <IconSymbol name="sparkles" size={28} color={theme.primary} />
            </View>
            <AppText variant="caption" color="primary" style={styles.onboardingEyebrow}>WELCOME TO ANYMARKET</AppText>
            <AppText variant="title1" style={styles.onboardingTitle}>Make your first market with friends.</AppText>
            <AppText variant="body" color="secondary" style={styles.onboardingBody}>
              Start a private group, join one with a code, or browse public markets while you wait for friends to join.
            </AppText>

            <StaggerGroup>
              <View style={styles.onboardingSteps}>
              {ONBOARDING_STEPS.map(([step, title, copy]) => (
                <View key={step} style={styles.onboardingStep}>
                  <View style={[styles.onboardingStepBadge, { backgroundColor: `${theme.primary}18` }]}>
                    <AppText variant="label" color="primary">{step}</AppText>
                  </View>
                  <View style={styles.onboardingStepCopy}>
                    <AppText variant="body" style={{ fontWeight: '400' }}>{title}</AppText>
                    <AppText variant="bodySm" color="secondary">{copy}</AppText>
                  </View>
                </View>
              ))}
              </View>
            </StaggerGroup>

            <AppButton
              title="Create my first group"
              onPress={() => openModal()}
              style={styles.onboardingPrimaryButton}
            />

            <AppButton
              title={showJoinInput ? "Hide invite code" : "I have an invite code"}
              variant="secondary"
              onPress={() => setShowJoinInput(!showJoinInput)}
              style={styles.onboardingSecondaryButton}
            />

            <AppButton
              title="Explore public markets"
              variant="ghost"
              onPress={() => navigate("/feed", { message: "Loading live markets..." })}
              style={styles.onboardingExploreButton}
            />

            {showJoinInput && (
              <View style={styles.onboardingJoinPanel}>
                <CodeInput value={joinCode} onChange={setJoinCode} length={6} autoFocus />
                {joinCode.length === 6 && (
                  <AppButton
                    title="Join Group"
                    loading={createLoading}
                    onPress={() => handleJoinGroup(joinCode)}
                    style={styles.confirmJoinBtn}
                  />
                )}
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={sortedGroups}
          renderItem={renderGroup}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            showJoinInput ? (
              <View style={{ borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }}>
                <View style={styles.headerJoinPanel}>
                  <CodeInput value={joinCode} onChange={setJoinCode} length={6} autoFocus />
                  {joinCode.length === 6 && (
                    <AppButton
                      title="Join Now"
                      loading={createLoading}
                      onPress={() => handleJoinGroup(joinCode)}
                      style={styles.headerJoinSubmit}
                    />
                  )}
                </View>
              </View>
            ) : null
          }
          ItemSeparatorComponent={
            isListPane
              ? undefined
              : () => <View style={[styles.groupSeparator, { backgroundColor: theme.border }]} />
          }
          getItemLayout={(_, index) => {
            const rowHeight = isListPane ? 72 : GROUP_ROW_HEIGHT;
            return {
              length: rowHeight + StyleSheet.hairlineWidth,
              offset: (rowHeight + StyleSheet.hairlineWidth) * index,
              index,
            };
          }}
          removeClippedSubviews={Platform.OS !== "web"}
        />
      );

  if (groupsLoading) {
    return <AnymarktLoader message="Opening your groups..." />;
  }

  const pageTitleBlock = (
    <View style={[styles.pageTitle, isListPane && styles.pageTitleListPane]}>
      <View style={styles.headerLeft}>
        <AppText variant="title3">Groups</AppText>
        <AppText variant="caption" color="secondary">
          {groups.length} groups{totalUnread > 0 ? ` · ${totalUnread} unread` : ""}
        </AppText>
      </View>
    </View>
  );

  const createModal = (
    <CreateGroupModal
      visible={isCreateModalVisible}
      onClose={() => setCreateModalVisible(false)}
      onCreate={handleCreateGroup}
      onJoin={handleJoinGroup}
      loading={createLoading}
    />
  );

  if (isListPane) {
    return (
      <View style={[styles.listPaneContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.listPaneHeader, { borderBottomColor: theme.border }]}>
          {pageTitleBlock}
          <View style={styles.listPaneHeaderActions}>{listHeaderActions}</View>
        </View>
        {groupsListBody}
        {createModal}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <GlobalHeader showToggle={!isDesktopWebNav} right={listHeaderActions} />
      <WebContentColumn variant="social" style={styles.socialColumn}>
        {pageTitleBlock}
        {groupsListBody}
        {createModal}
      </WebContentColumn>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  listPaneContainer: {
    flex: 1,
    minHeight: 0,
  },
  listPaneHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: DESKTOP_SPLIT_HEADER_HEIGHT,
    paddingRight: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listPaneHeaderActions: {
    flexShrink: 0,
  },
  socialColumn: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
  },
  pageTitle: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  pageTitleListPane: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 0,
  },
  headerLeft: {
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headerButton: {
    padding: 8,
  },
  statsWheelContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  statsWheel: {
    maxHeight: 40,
  },
  statRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 20,
    paddingVertical: 4,
  },
  statPill: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 75,
    minHeight: 32,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "400",
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '400',
    fontVariant: ["tabular-nums"],
  },
  list: {
    paddingBottom: 4,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
  },
  groupItem: {
    flexDirection: "row",
    alignItems: "center",
    height: GROUP_ROW_HEIGHT,
    paddingHorizontal: 16,
    backgroundColor: "#000000",
    gap: 12,
  },
  groupItemPressed: {
    transform: [{ scale: 0.992 }],
    opacity: 0.94,
  },
  groupSeparator: {
    height: 1,
    marginLeft: 80,
    marginRight: 16,
  },
  groupIconContainer: {
    width: GROUP_ICON_SIZE,
    height: GROUP_ICON_SIZE,
    position: "relative",
    flexShrink: 0,
  },
  groupIcon: {
    width: GROUP_ICON_SIZE,
    height: GROUP_ICON_SIZE,
    borderRadius: GROUP_ICON_SIZE / 2,
  },
  groupIconPlaceholder: {
    width: GROUP_ICON_SIZE,
    height: GROUP_ICON_SIZE,
    borderRadius: GROUP_ICON_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  groupInitials: {
    fontSize: 20,
    fontWeight: '400',
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: Brand.primary,
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
    borderWidth: 2,
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: '400',
  },
  groupInfo: {
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
    height: "100%",
    paddingVertical: 10,
  },
  groupHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  groupName: {
    fontSize: 15,
    fontWeight: '400',
    flex: 1,
    marginRight: 8,
    letterSpacing: -0.3,
  },
  groupTime: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 14,
    height: 14,
    marginBottom: 5,
    fontVariant: ["tabular-nums"],
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  senderName: {
    fontSize: 14,
    fontWeight: "400",
  },
  previewText: {
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 18,
    flex: 1,
    minWidth: 0,
  },
  groupTradingInfo: {
    width: GROUP_TRADING_RAIL_WIDTH,
    flexShrink: 0,
    alignItems: "flex-end",
    justifyContent: "center",
    alignSelf: "stretch",
  },
  tradingPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 9,
    height: 38,
    width: GROUP_TRADING_RAIL_WIDTH,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  tradingPrimary: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 14,
    fontVariant: ["tabular-nums"],
  },
  tradingSecondary: {
    fontSize: 10,
    fontWeight: '400',
    lineHeight: 12,
    marginTop: 1,
    fontVariant: ["tabular-nums"],
  },
  groupMeta: {
    // Deprecated, use previewText
    fontSize: 15,
  },
  onboardingScroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  onboardingCard: {
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  onboardingHeroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  onboardingEyebrow: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 1,
    marginBottom: 8,
  },
  onboardingTitle: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '400',
    letterSpacing: -0.8,
    marginBottom: 12,
  },
  onboardingBody: {
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 24,
  },
  onboardingSteps: {
    gap: 16,
    marginBottom: 24,
  },
  onboardingStep: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  onboardingStepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  onboardingStepNumber: {
    fontSize: 14,
    fontWeight: '400',
  },
  onboardingStepCopy: {
    flex: 1,
  },
  onboardingStepTitle: {
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 3,
  },
  onboardingStepBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  onboardingPrimaryButton: {
    minHeight: 52,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  onboardingPrimaryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: '400',
  },
  onboardingSecondaryButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    alignItems: "center",
  },
  onboardingSecondaryText: {
    fontSize: 15,
    fontWeight: '400',
  },
  onboardingExploreButton: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  onboardingExploreText: {
    fontSize: 15,
    fontWeight: '400',
  },
  onboardingJoinPanel: {
    width: "100%",
    marginTop: 18,
    alignItems: "center",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '400',
    color: "#1A1A1A",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: "#8E8E93",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignItems: "center",
    alignSelf: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "400",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalKeyboardAvoiding: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  modalContent: {
    backgroundColor: "#000000",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 10 : 20,
    minHeight: 250,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '400',
    color: "#111B21",
  },
  closeModalText: {
    color: Brand.primary,
    fontSize: 16,
  },
  modalInput: {
    backgroundColor: "#000000",
    padding: 16,
    borderRadius: 16,
    fontSize: 16,
    marginBottom: 24,
  },
  createModalButton: {
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 20,
    alignItems: "center",
    alignSelf: 'center',
    minWidth: 160,
  },
  createModalButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "400",
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    borderRadius: 8,
    padding: 2,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '400',
  },
  // New styles for CodeInput integration
  confirmJoinBtn: {
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  confirmJoinBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
  },
  headerJoinPanel: {
    paddingBottom: 20,
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 10,
  },
  headerJoinSubmit: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 20,
    minWidth: 140,
    alignItems: 'center',
  },
  headerJoinSubmitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '400',
  },
});


