import { decode } from "base64-arraybuffer";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from "react-native";
import { IconSymbol } from "../components/ui/icon-symbol";
import { useAuthContext } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useGroups } from "../hooks/useGroups";
import { messageService } from "../services/message.service";
import type { GroupSummary } from "../types/group";
import type { Message } from "../types/message";

export function HomeScreen() {
  const router = useRouter();
  const { groups, loading: groupsLoading, createGroup, joinGroup, refresh } = useGroups();
  const { user } = useAuthContext();
  const { theme, isDark } = useTheme();
  const [lastMessages, setLastMessages] = useState<Record<string, Message | null>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Group state
  const [isCreateModalVisible, setCreateModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'join'>('create');
  const [inputValue, setInputValue] = useState("");
  const [descriptionValue, setDescriptionValue] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  const handleGroupAction = async () => {
    if (!inputValue.trim()) {
      Alert.alert("Error", `Please enter a ${modalMode === 'create' ? 'group name' : '4-letter code'}`);
      return;
    }

    Keyboard.dismiss();
    setCreateLoading(true);
    try {
      if (modalMode === 'create') {
        const { error } = await createGroup(inputValue, descriptionValue);
        if (error) throw error;
      } else {
        const { error } = await joinGroup(inputValue);
        if (error) throw error;
      }

      setCreateModalVisible(false);
      setInputValue("");
      setDescriptionValue("");
      // Note: refresh() is no longer needed - createGroup/joinGroup handle state updates
      // and real-time subscription will sync any changes
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

  // Memoize refresh callback for useFocusEffect
  const handleFocusRefresh = useCallback(() => {
    if (!user) return;
    refresh();
  }, [user, refresh]);

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
                backgroundColor: isDark ? "#2C2C2E" : "#E5E5EA",
                borderColor: isDark ? "transparent" : "#D1D1D6"
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

        <Text style={[styles.headerTitle, { color: theme.text }]}>Groups</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => openModal('create')}
        >
          <IconSymbol name="plus" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {groups.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.text }]}>No groups yet</Text>
          <Text style={styles.emptySubtext}>
            Start a prediction group with your friends
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={() => setCreateModalVisible(true)}
          >
            <Text style={styles.buttonText}>Create Group</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={groups}
          renderItem={renderGroup}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: isDark ? theme.border : "#C6C6C8", marginLeft: 76 }]} />
          )}
        />
      )}

      <Modal
        visible={isCreateModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.modalKeyboardAvoiding}
            >
              <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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
                        style={[styles.modalInput, { backgroundColor: isDark ? theme.background : "#F0F2F5", color: theme.text }]}
                        placeholder={modalMode === 'create' ? "Group Name" : "Enter invite code (e.g. A1B2C3)"}
                        placeholderTextColor="#999"
                        value={inputValue}
                        onChangeText={setInputValue}
                        autoFocus
                        autoCapitalize={modalMode === 'join' ? "characters" : "sentences"}
                        maxLength={modalMode === 'join' ? 6 : 50}
                      />

                      {modalMode === 'create' && (
                        <TextInput
                          style={[styles.modalInput, { backgroundColor: isDark ? theme.background : "#F0F2F5", color: theme.text, minHeight: 100, textAlignVertical: 'top' }]}
                          placeholder="Group Description (Optional)"
                          placeholderTextColor="#999"
                          value={descriptionValue}
                          onChangeText={setDescriptionValue}
                          multiline
                        />
                      )}

                      <TouchableOpacity
                        style={[styles.createModalButton, { backgroundColor: theme.primary }, createLoading && { opacity: 0.5 }]}
                        onPress={handleGroupAction}
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
    backgroundColor: "#F2F2F7",
    paddingBottom: Platform.OS === "ios" ? 80 : 70,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "500",
    color: "#000",
  },
  headerButton: {
    padding: 8,
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    // Removed margins and shadows for flat list feel
    backgroundColor: "transparent",
  },
  groupIconContainer: {
    width: 60,
    height: 60,
    marginRight: 16,
    position: "relative",
  },
  groupIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  groupIconPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  groupInitials: {
    fontSize: 24,
    fontWeight: "600",
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#007AFF",
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
    fontWeight: "600",
  },
  groupInfo: {
    flex: 1,
    justifyContent: "center",
    height: 60, // Ensure height alignment
  },
  groupHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end", // Align text baselines nicely
    marginBottom: 4,
  },
  groupName: {
    fontSize: 17,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
    letterSpacing: -0.4,
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
    fontSize: 15,
    color: "#111B21",
    fontWeight: "600",
  },
  previewText: {
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 20,
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
    fontWeight: "600",
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
    fontWeight: "500",
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
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 10 : 20,
    minHeight: 250,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111B21",
  },
  closeModalText: {
    color: "#007AFF",
    fontSize: 16,
  },
  modalInput: {
    backgroundColor: "#F0F2F5",
    padding: 16,
    borderRadius: 16,
    fontSize: 16,
    color: "#111B21",
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
    fontWeight: "500",
  },

});


