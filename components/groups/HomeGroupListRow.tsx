import { Brand } from "@/constants/theme";
import { Image } from "expo-image";
import { useGroupNavigation } from "@/hooks/useGroupNavigation";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { ACTIVE_OPACITY } from "@/constants/motion";
import { useTheme } from "@/contexts/ThemeContext";
import type { GroupSummary } from "@/types/group";
import type { Message } from "@/types/message";

export interface HomeGroupListRowProps {
  group: GroupSummary;
  lastMessage: Message | null | undefined;
  unreadCount: number;
  currentUserId?: string;
}

export function HomeGroupListRow({
  group,
  lastMessage,
  unreadCount,
  currentUserId,
}: HomeGroupListRowProps) {
  const { openGroup } = useGroupNavigation();
  const { theme, isDark } = useTheme();

  const getSenderName = () => {
    if (!lastMessage) return null;
    if (lastMessage.user?.username) return lastMessage.user.username;
    if (lastMessage.user?.email) {
      const emailParts = lastMessage.user.email.split("@");
      return emailParts[0] || "User";
    }
    return "User";
  };

  const senderName = getSenderName();
  const isMyMessage = lastMessage?.user_id === currentUserId;

  const getPreviewText = () => {
    if (!lastMessage) return "No messages yet";
    if (lastMessage.message_type === "market") {
      return `${isMyMessage ? "You" : senderName} started a prediction`;
    }
    return lastMessage.content || "Message";
  };

  const previewText = getPreviewText();
  const messageTime = lastMessage
    ? new Date(lastMessage.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : new Date(group.created_at || new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: theme.background }]}
      activeOpacity={ACTIVE_OPACITY}
      accessibilityRole="button"
      accessibilityLabel={`Open group ${group.name}`}
      onPress={() => openGroup(group.id)}
    >
      <View style={styles.iconWrap}>
        {group.avatar_url ? (
          <Image source={{ uri: group.avatar_url }} style={[styles.icon, { borderRadius: theme.radius.pill }]} contentFit="cover" />
        ) : (
          <View
            style={[
              styles.icon,
              {
                backgroundColor: theme.background,
                borderColor: theme.border,
                borderWidth: StyleSheet.hairlineWidth,
                borderRadius: theme.radius.pill,
              },
            ]}
          >
            <AppText variant="title2" color={isDark ? "default" : "muted"}>
              {(group.name || "G").substring(0, 1).toUpperCase()}
            </AppText>
          </View>
        )}
        {unreadCount > 0 ? (
          <View style={[styles.badge, { borderColor: theme.background, borderRadius: theme.radius.pill }]}>
            <AppText variant="caption" color="onPrimary">
              {unreadCount > 99 ? "99+" : String(unreadCount)}
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.info}>
        <View style={styles.headerRow}>
          <AppText variant="body" numberOfLines={1} style={styles.name}>
            {group.name}
          </AppText>
          <AppText variant="caption" color="muted">
            {messageTime}
          </AppText>
        </View>
        <AppText variant="bodySm" color="secondary" numberOfLines={2}>
          {isMyMessage ? "You: " : senderName ? `${senderName}: ` : ""}
          {previewText}
        </AppText>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  iconWrap: {
    width: 52,
    height: 52,
    marginRight: 12,
    position: "relative",
  },
  icon: {
    width: 52,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: Brand.primary,
    minWidth: 22,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
    borderWidth: 2,
  },
  info: {
    flex: 1,
    justifyContent: "center",
    height: 52,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 4,
  },
  name: {
    flex: 1,
    marginRight: 8,
  },
});
