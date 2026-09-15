import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { HomeGroupListRow } from "@/components/groups/HomeGroupListRow";
import {
  AppButton,
  AppIconButton,
  AppInput,
  AppScreen,
  AppText,
  EmptyState,
  FieldGroup,
  ModalHeader,
} from "@/components/ui";
import { CodeInput } from "@/components/ui/CodeInput";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SECTION_GAP_MD } from "@/constants/layout";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
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
  const { groups, loading: groupsLoading, createGroup, joinGroup, refresh } = useGroups();
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

  const [isCreateModalVisible, setCreateModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "join">("create");
  const [inputValue, setInputValue] = useState("");
  const [descriptionValue, setDescriptionValue] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);

  const prevGroupIdsRef = useRef<string>("");

  const handleGroupAction = async (codeToJoin?: string) => {
    const finalCode = codeToJoin || inputValue;

    if (!finalCode.trim()) {
      Alert.alert(
        "Error",
        `Please enter a ${modalMode === "create" && !codeToJoin ? "group name" : "4-letter code"}`,
      );
      return;
    }

    Keyboard.dismiss();
    setCreateLoading(true);
    try {
      if (modalMode === "create" && !codeToJoin) {
        const { error } = await createGroup(finalCode, descriptionValue);
        if (error) throw error;
      } else {
        const { error } = await joinGroup(finalCode.toUpperCase());
        if (error) throw error;
      }

      setCreateModalVisible(false);
      setInputValue("");
      setDescriptionValue("");
      setJoinCode("");
      setShowJoinInput(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred";
      const message =
        errorMessage === "Group not found" ? "Invalid code. Please check and try again." : errorMessage;
      Alert.alert("Failed", message);
    } finally {
      setCreateLoading(false);
    }
  };

  const openModal = (mode: "create" | "join") => {
    setModalMode(mode);
    setInputValue("");
    setDescriptionValue("");
    setCreateModalVisible(true);
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
            icon={<IconSymbol name="person.3.fill" size={24} color={theme.text} />}
            accessibilityLabel="Toggle join group"
            onPress={() => setShowJoinInput(!showJoinInput)}
            style={{ marginRight: 8 }}
          />
          <AppIconButton
            icon={<IconSymbol name="plus" size={24} color={theme.text} />}
            accessibilityLabel="Create new group"
            onPress={() => openModal("create")}
          />
        </View>
      </View>

      {groups.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="people-outline"
            title="No groups yet"
            description="Start a prediction group with your friends"
            actionLabel={showJoinInput ? "Cancel" : "Join a Group"}
            onAction={() => setShowJoinInput(!showJoinInput)}
            secondaryActionLabel="Create New Group"
            onSecondaryAction={() => openModal("create")}
          />
          {showJoinInput ? (
            <View style={styles.emptyJoinPanel}>
              <CodeInput value={joinCode} onChange={setJoinCode} length={6} autoFocus />
              {joinCode.length === 6 ? (
                <AppButton
                  title="Join Group"
                  loading={createLoading}
                  onPress={() => handleGroupAction(joinCode)}
                  style={{ marginTop: SECTION_GAP_MD }}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={groups}
          renderItem={renderGroup}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            showJoinInput ? (
              <View style={{ borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }}>
                <View style={[styles.headerJoinPanel, { paddingHorizontal: theme.spacing.lg }]}>
                  <CodeInput value={joinCode} onChange={setJoinCode} length={6} autoFocus />
                  {joinCode.length === 6 ? (
                    <AppButton
                      title="Join Now"
                      loading={createLoading}
                      onPress={() => handleGroupAction(joinCode)}
                      style={{ marginTop: theme.spacing.md, minWidth: 140 }}
                    />
                  ) : null}
                </View>
              </View>
            ) : null
          }
          ItemSeparatorComponent={() => (
            <View style={[styles.groupSeparator, { backgroundColor: theme.border }]} />
          )}
        />
      )}

      <Modal visible={isCreateModalVisible} transparent animationType="slide" onRequestClose={() => setCreateModalVisible(false)}>
        <TouchableWithoutFeedback onPress={Platform.OS === "web" ? undefined : Keyboard.dismiss}>
          <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalKeyboardAvoiding}>
              <View
                style={[
                  styles.modalContent,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    borderTopLeftRadius: theme.radius.xl,
                    borderTopRightRadius: theme.radius.xl,
                  },
                ]}
              >
                <ModalHeader
                  title={modalMode === "create" ? "New Group" : "Join Group"}
                  closeLabel="Cancel"
                  onClose={() => setCreateModalVisible(false)}
                />
                <FieldGroup>
                  <AppInput
                    placeholder={modalMode === "create" ? "Group Name" : "Enter invite code (e.g. A1B2C3)"}
                    value={inputValue}
                    onChangeText={(text) => setInputValue(modalMode === "join" ? text.toUpperCase() : text)}
                    autoFocus
                    autoCapitalize={modalMode === "join" ? "characters" : "sentences"}
                    maxLength={modalMode === "join" ? 6 : 50}
                  />
                  {modalMode === "create" ? (
                    <AppInput
                      placeholder="Group Description (Optional)"
                      value={descriptionValue}
                      onChangeText={setDescriptionValue}
                      multiline
                      style={{ minHeight: 100, textAlignVertical: "top" }}
                    />
                  ) : null}
                  <AppButton
                    title={modalMode === "create" ? "Create Group" : "Join Group"}
                    loading={createLoading}
                    onPress={() => handleGroupAction()}
                  />
                </FieldGroup>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalKeyboardAvoiding: {
    width: "100%",
  },
  modalContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 10 : 20,
    minHeight: 250,
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerJoinPanel: {
    paddingBottom: 20,
    alignItems: "center",
  },
  emptyWrap: {
    flex: 1,
  },
  emptyJoinPanel: {
    width: "100%",
    maxWidth: 350,
    alignSelf: "center",
    paddingHorizontal: 32,
    marginTop: -24,
    marginBottom: 32,
  },
});
