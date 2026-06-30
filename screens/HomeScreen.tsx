import { Brand } from "@/constants/theme";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from "react-native";
import { CodeInput } from "../components/ui/CodeInput";
import { IconSymbol } from "../components/ui/icon-symbol";
import { useAuthContext } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useGroups } from "../hooks/useGroups";
import { betService } from "../services/bet.service";
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

export function HomeScreen() {
  const router = useRouter();
  const { groups, loading: groupsLoading, createGroup, joinGroup, refresh } = useGroups();
  const { user } = useAuthContext();
  const { theme, isDark } = useTheme();
  const [lastMessages, setLastMessages] = useState<Record<string, Message | null>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
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
  const [modalMode, setModalMode] = useState<'create' | 'join'>('create');
  const [inputValue, setInputValue] = useState("");
  const [descriptionValue, setDescriptionValue] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  
  // Separate state for the inline Join Code input to avoid conflicts and cursor jumps
  const [joinCode, setJoinCode] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);

  const handleGroupAction = async (codeToJoin?: string) => {
    // If a code is provided directly (from inline input), use it
    const finalCode = codeToJoin || inputValue;
    
    if (!finalCode.trim()) {
      Alert.alert("Error", `Please enter a ${modalMode === 'create' && !codeToJoin ? 'group name' : '4-letter code'}`);
      return;
    }

    Keyboard.dismiss();
    setCreateLoading(true);
    try {
      if (modalMode === 'create' && !codeToJoin) {
        const { error } = await createGroup(finalCode, descriptionValue);
        if (error) throw error;
      } else {
        // Join Group
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
      const message = errorMessage === 'Group not found'
        ? "Invalid code. Please check and try again."
        : errorMessage;
      Alert.alert("Failed", message);
    } finally {
      setCreateLoading(false);
    }
  };

  const openModal = (mode: 'create' | 'join') => {
    setModalMode(mode);
    setInputValue("");
    setDescriptionValue("");
    setCreateModalVisible(true);
  };

  // ... (keeping existing refs and initial effects)

  // Track group IDs to avoid refetching messages unnecessarily
  const prevGroupIdsRef = useRef<string>("");

  // Fetch last messages and unread counts for all groups
  useEffect(() => {
    if (!user || groups.length === 0) return;

    // Only refetch if group list actually changed
    const currentGroupIds = groups.map(g => g.id).sort().join(",");
    if (currentGroupIds === prevGroupIdsRef.current) return;
    prevGroupIdsRef.current = currentGroupIds;

    const fetchLastMessages = async () => {
      setLoadingMessages(true);
      const messages: Record<string, Message | null> = {};
      const counts: Record<string, number> = {};

      for (const group of groups) {
        const lastMessage = await messageService.getLastMessage(group.id);
        messages[group.id] = lastMessage;

        const unreadCount = await messageService.getUnreadCount(group.id, user.id);
        counts[group.id] = unreadCount;
      }

      setLastMessages(messages);
      setUnreadCounts(counts);
      setLoadingMessages(false);
    };

    fetchLastMessages();
  }, [groups, user]);

  const totalUnread = useMemo(() => {
    return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
  }, [unreadCounts]);

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
  }, [user, refresh, fetchBetStats]);

  useFocusEffect(
    useCallback(() => {
      handleFocusRefresh();
    }, [handleFocusRefresh])
  );

  const renderGroup = ({ item }: { item: GroupSummary }) => {
    const lastMessage = lastMessages[item.id];
    const unreadCount = unreadCounts[item.id] || 0;

    const getSenderName = () => {
      if (!lastMessage) return null;
      if (lastMessage.user?.username) return lastMessage.user.username;
      if (lastMessage.user?.email) {
        const emailParts = lastMessage.user.email.split('@');
        return emailParts[0] || "User";
      }
      return "User";
    };

    const senderName = getSenderName();
    const isMyMessage = lastMessage?.user_id === user?.id;

    const getPreviewText = () => {
      if (!lastMessage) return "No messages yet";
      if (lastMessage.message_type === "market") {
        return `${isMyMessage ? "You" : senderName} started a prediction`;
      }
      return lastMessage.content || "Message";
    };

    const previewText = getPreviewText();
    const messageTime = lastMessage
      ? new Date(lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : new Date(item.created_at || new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <TouchableOpacity
        style={[styles.groupItem, { backgroundColor: theme.background }]}
        activeOpacity={0.7}
        onPress={() => router.push(`/group/${item.id}` as any)}
      >
        <View style={styles.groupIconContainer}>
          {item.avatar_url ? (
            <Image
              source={{ uri: item.avatar_url }}
              style={styles.groupIcon}
              contentFit="cover"
            />
          ) : (
            <View style={[
              styles.groupIconPlaceholder,
              {
                backgroundColor: theme.background,
                borderColor: theme.border,
                borderWidth: StyleSheet.hairlineWidth
              }
            ]}>
              <Text style={[styles.groupInitials, { color: isDark ? theme.text : "#8E8E93" }]}>
                {(item.name || "G").substring(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
          {unreadCount > 0 && (
            <View style={[styles.badge, { borderColor: theme.background }]}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.groupInfo}>
          <View style={styles.groupHeaderRow}>
            <Text style={[styles.groupName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.groupTime}>{messageTime}</Text>
          </View>
          <View style={styles.previewRow}>
            {!isMyMessage && (
              <Text style={[styles.previewText, { color: theme.textSecondary }]} numberOfLines={2}>
                {senderName && <Text style={[styles.senderName, { color: theme.text }]}>{senderName}: </Text>}
                {previewText}
              </Text>
            )}
            {isMyMessage && (
              <Text style={[styles.previewText, { color: theme.textSecondary }]} numberOfLines={2}>
                <Text style={[styles.senderName, { color: isDark ? "#A1A1A6" : "#111B21" }]}>You: </Text>
                {previewText}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (groupsLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.text} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Groups</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Social + markets</Text>
          <View style={styles.statsWheelContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statRow}
              style={styles.statsWheel}
            >
              <View style={[styles.statPill, { borderColor: theme.primary, backgroundColor: `${theme.primary}15` }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Gained</Text>
                <Text style={[styles.statValue, { color: theme.primary }]}>${betStats.gained.toFixed(2)}</Text>
              </View>
              <View style={[styles.statPill, { borderColor: theme.error, backgroundColor: `${theme.error}15` }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Loss</Text>
                <Text style={[styles.statValue, { color: theme.error }]}>${betStats.loss.toFixed(2)}</Text>
              </View>
              <View style={[styles.statPill, { borderColor: theme.border }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Bets</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>{betStats.totalBets}</Text>
              </View>
              <View style={[styles.statPill, { borderColor: theme.border }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Groups</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>{groups.length}</Text>
              </View>
              <View style={[styles.statPill, { borderColor: theme.border }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Unread</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>{totalUnread}</Text>
              </View>
              <View style={[styles.statPill, { borderColor: theme.border }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Active Bets</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>{betStats.activeBets}</Text>
              </View>
              <View style={[styles.statPill, { borderColor: theme.border }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Closed Bets</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>{betStats.closedBets}</Text>
              </View>
            </ScrollView>
          </View>
        </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={[styles.headerButton, { marginRight: 8 }]}
              onPress={() => {
                setShowJoinInput(!showJoinInput);
                // If opening, ensure list scrolls to top or appropriate feedback
              }}
            >
              <IconSymbol name="person.3.fill" size={24} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => openModal('create')}
            >
              <IconSymbol name="plus" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
      </View>

      
      {groups.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.text }]}>No groups yet</Text>
          <Text style={styles.emptySubtext}>
            Start a prediction group with your friends
          </Text>
          
          {/* Inline Join Group for Empty State */}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary, width: '100%', maxWidth: 300 }]}
            onPress={() => setShowJoinInput(!showJoinInput)}
          >
            <Text style={styles.buttonText}>{showJoinInput ? "Cancel" : "Join a Group"}</Text>
          </TouchableOpacity>

          {showJoinInput && (
            <View style={{ width: '100%', maxWidth: 350, marginTop: 20 }}>
              <CodeInput value={joinCode} onChange={setJoinCode} length={6} autoFocus />
              {joinCode.length === 6 && (
                <TouchableOpacity
                  style={[styles.confirmJoinBtn, { backgroundColor: theme.primary }]}
                  onPress={() => handleGroupAction(joinCode)}
                  disabled={createLoading}
                >
                  {createLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.confirmJoinBtnText}>Join Group</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary, marginTop: 24 }]}
            onPress={() => openModal('create')}
          >
            <Text style={styles.buttonText}>Create New Group</Text>
          </TouchableOpacity>
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
                <View style={styles.headerJoinPanel}>
                  <CodeInput value={joinCode} onChange={setJoinCode} length={6} autoFocus />
                  {joinCode.length === 6 && (
                    <TouchableOpacity
                      style={[styles.headerJoinSubmit, { backgroundColor: theme.primary }]}
                      onPress={() => handleGroupAction(joinCode)}
                      disabled={createLoading}
                    >
                      {createLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.headerJoinSubmitText}>Join Now</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : null
          }
          ItemSeparatorComponent={() => (
            <View style={[styles.groupSeparator, { backgroundColor: theme.border }]} />
          )}
        />
      )}
      
      <Modal
        visible={isCreateModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.modalKeyboardAvoiding}
            >
              <View style={[styles.modalContent, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>
                    {modalMode === 'create' ? "New Group" : "Join Group"}
                  </Text>
                  <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                    <Text style={styles.closeModalText}>Cancel</Text>
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={[]}
                  renderItem={() => null}
                  ListHeaderComponent={
                    <>
                      <TextInput
                        style={[styles.modalInput, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth, color: theme.text }, Platform.OS === 'web' && ({ cursor: 'text' } as any)]}
                        placeholder={modalMode === 'create' ? "Group Name" : "Enter invite code (e.g. A1B2C3)"}
                        placeholderTextColor={theme.textSecondary}
                        value={inputValue}
                        onChangeText={(text) => setInputValue(modalMode === 'join' ? text.toUpperCase() : text)}
                        autoFocus
                        autoCapitalize="sentences"
                        maxLength={modalMode === 'join' ? 6 : 50}
                      />

                      {modalMode === 'create' && (
                        <TextInput
                          style={[styles.modalInput, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth, color: theme.text, minHeight: 100, textAlignVertical: 'top' }, Platform.OS === 'web' && ({ cursor: 'text' } as any)]}
                          placeholder="Group Description (Optional)"
                          placeholderTextColor={theme.textSecondary}
                          value={descriptionValue}
                          onChangeText={setDescriptionValue}
                          multiline
                        />
                      )}

                      <TouchableOpacity
                        style={[styles.createModalButton, { backgroundColor: theme.primary }, createLoading && { opacity: 0.5 }]}
                        onPress={() => handleGroupAction()}
                        disabled={createLoading}
                      >
                        <Text style={styles.createModalButtonText}>
                          {createLoading ? "Processing..." : modalMode === 'create' ? "Create Group" : "Join Group"}
                        </Text>
                      </TouchableOpacity>
                    </>
                  }
                  style={{ flexGrow: 0 }}
                  keyboardShouldPersistTaps="handled"
                />
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    paddingBottom: Platform.OS === "ios" ? 80 : 70,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "400",
    color: "#000",
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: "400",
    marginBottom: 6,
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
  },
  list: {
    paddingBottom: 40,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
  },
  groupItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#000000",
  },
  groupSeparator: {
    height: 1,
    marginLeft: 80,
  },
  groupIconContainer: {
    width: 52,
    height: 52,
    marginRight: 12,
    position: "relative",
  },
  groupIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  groupIconPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
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
    height: 52, // Ensure height alignment
  },
  groupHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end", // Align text baselines nicely
    marginBottom: 4,
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
    color: "#8E8E93",
    fontWeight: "400",
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  senderName: {
    fontSize: 14,
    color: "#111B21",
    fontWeight: "400",
  },
  previewText: {
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 18,
    flex: 1,
  },
  groupMeta: {
    // Deprecated, use previewText
    fontSize: 15,
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
  inlineJoinContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 10, // Changed from -10 to 10
  },
  inlineJoinInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginRight: 10,
  },
  inlineJoinButton: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineJoinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
  },
  inlineJoinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerJoinButton: {
    height: 44, // Slightly smaller than the empty state one
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerJoinButtonText: {
    color: '#fff',
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


