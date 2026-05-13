import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { groupService } from "@/services/group.service";
import { messageService } from "@/services/message.service";
import { shareService } from "@/services/share.service";
import type { GroupSummary } from "@/types/group";
import type { MessageInsert } from "@/types/message";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

interface ShareToGroupModalProps {
  visible: boolean;
  onClose: () => void;
  marketId: string;
  marketQuestion: string;
}

export function ShareToGroupModal({
  visible,
  onClose,
  marketId,
  marketQuestion,
}: ShareToGroupModalProps) {
  const { theme, isDark } = useTheme();
  const { user } = useAuthContext();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadGroups();
    }
  }, [visible]);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const userGroups = await groupService.getUserGroups();
      setGroups(userGroups);
    } catch (error) {
      console.error("Failed to load groups:", error);
      Alert.alert("Error", "Failed to load your groups");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (group: GroupSummary) => {
    if (!user) return;
    
    setSendingId(group.id);
    try {
      shareService.trackShare(marketId, "market", "internal").catch(console.error);
      const { error } = await messageService.sendMessage({
        group_id: group.id,
        user_id: user.id,
        content: `Shared from feed: ${marketQuestion}`,
        message_type: "shared_market",
        market_id: marketId,
      } as MessageInsert); // Cast needed if types aren't fully aligned yet

      if (error) throw error;

      Alert.alert("Success", `Shared to ${group.name}!`);
      onClose();
    } catch (error) {
      console.error("Failed to share market:", error);
      Alert.alert("Error", "Failed to share prediction to group");
    } finally {
      setSendingId(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.content,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.text }]}>
              Share to Group
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <IconSymbol
                name="xmark.circle.fill"
                size={28}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : groups.length === 0 ? (
            <View style={styles.centerContainer}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                You haven&apos;t joined any groups yet.
              </Text>
            </View>
          ) : (
            <FlatList
              data={groups}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.groupItem,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.05)"
                        : "#F2F2F7",
                    },
                    Platform.OS === "web" && ({ cursor: "pointer" } as any),
                  ]}
                  onPress={() => handleShare(item)}
                  disabled={!!sendingId}
                >
                  {item.avatar_url ? (
                    <Image
                      source={{ uri: item.avatar_url }}
                      style={styles.groupAvatar}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.groupAvatarPlaceholder,
                        { backgroundColor: theme.primary + "20" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.groupAvatarInitials,
                          { color: theme.primary },
                        ]}
                      >
                        {item.name[0]?.toUpperCase() || "G"}
                      </Text>
                    </View>
                  )}
                  
                  <View style={styles.groupInfo}>
                    <Text style={[styles.groupName, { color: theme.text }]}>
                      {item.name}
                    </Text>
                    {item.description && (
                      <Text
                        style={[
                          styles.groupDescription,
                          { color: theme.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {item.description}
                      </Text>
                    )}
                  </View>

                  {sendingId === item.id ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <IconSymbol
                      name="paperplane.fill"
                      size={20}
                      color={theme.primary}
                    />
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  content: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingBottom: 40,
    maxHeight: "80%",
    minHeight: 400,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  closeButton: {
    padding: 4,
  },
  centerContainer: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
  },
  listContent: {
    padding: 16,
  },
  groupItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  groupAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  groupAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  groupAvatarInitials: {
    fontSize: 18,
    fontWeight: "600",
  },
  groupInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  groupName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  groupDescription: {
    fontSize: 13,
  },
});
