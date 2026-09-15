import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { ACTIVE_OPACITY } from "@/constants/motion";
import { formatCurrency } from "@/lib/parimutuel";
import { useTheme } from "@/contexts/ThemeContext";
import type { GroupSummary } from "@/types/group";
import type { Message } from "@/types/message";

export type GroupListRowTradingSummary = {
  primary: string;
  secondary: string;
  isLive: boolean;
};

export interface GroupListRowProps {
  group: GroupSummary;
  lastMessage: Message | null | undefined;
  unreadCount: number;
  tradingSummary: GroupListRowTradingSummary;
  selected?: boolean;
  currentUserId?: string;
  onPress: () => void;
}

export function GroupListRow({
  group,
  lastMessage,
  unreadCount,
  tradingSummary,
  selected = false,
  currentUserId,
  onPress,
}: GroupListRowProps) {
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
    if (lastMessage.message_type === "shared_group") {
      return `${isMyMessage ? "You" : senderName} shared a group`;
    }
    if (lastMessage.message_type === "shared_profile") {
      return `${isMyMessage ? "You" : senderName} shared a profile`;
    }
    if (lastMessage.message_type === "shared_bet") {
      return `${isMyMessage ? "You" : senderName} shared a bet`;
    }
    return lastMessage.content || "Message";
  };

  const previewText = getPreviewText();
  const messageTime = lastMessage
    ? new Date(lastMessage.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : new Date(group.created_at || new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const previewLine = isMyMessage
    ? `You: ${previewText}`
    : senderName
      ? `${senderName}: ${previewText}`
      : previewText;

  const statsLine = tradingSummary.secondary
    ? `${tradingSummary.primary} · ${tradingSummary.secondary}`
    : tradingSummary.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open group ${group.name}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: selected ? theme.primarySoft : theme.background,
          borderBottomColor: theme.border,
        },
        pressed && !selected && { opacity: ACTIVE_OPACITY },
      ]}
    >
      <View style={styles.avatarWrap}>
        {group.avatar_url ? (
          <Image
            source={{ uri: group.avatar_url }}
            style={[styles.avatar, { borderRadius: theme.radius.pill }]}
            contentFit="cover"
          />
        ) : (
          <View
            style={[
              styles.avatar,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                borderWidth: StyleSheet.hairlineWidth,
                borderRadius: theme.radius.pill,
                alignItems: "center",
                justifyContent: "center",
              },
            ]}
          >
            <AppText variant="title3" color={isDark ? "default" : "muted"}>
              {(group.name || "G").substring(0, 1).toUpperCase()}
            </AppText>
          </View>
        )}
        {unreadCount > 0 ? (
          <View style={[styles.badge, { backgroundColor: theme.primary, borderColor: theme.background, borderRadius: theme.radius.pill }]}>
            <AppText variant="caption" color="onPrimary">
              {unreadCount > 99 ? "99+" : String(unreadCount)}
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <AppText variant="body" numberOfLines={1} style={styles.title}>
            {group.name}
          </AppText>
          <AppText variant="caption" color="secondary">
            {messageTime}
          </AppText>
          {tradingSummary.isLive ? (
            <View style={[styles.liveDot, { backgroundColor: theme.primary, borderRadius: theme.radius.pill }]} />
          ) : null}
        </View>
        <AppText variant="bodySm" color="secondary" numberOfLines={1}>
          {previewLine}
        </AppText>
        <AppText variant="caption" color="muted" numberOfLines={1}>
          {statsLine}
        </AppText>
      </View>
    </Pressable>
  );
}

export function buildTradingSummary(stats?: {
  totalMarkets: number;
  activeMarkets: number;
  totalPool: number;
}): GroupListRowTradingSummary {
  const isLive = Boolean(stats && stats.activeMarkets > 0);
  if (!stats || stats.totalMarkets === 0) {
    return { primary: "No markets", secondary: "Create one", isLive };
  }
  if (stats.activeMarkets > 0) {
    return {
      primary: `${stats.activeMarkets} live`,
      secondary: stats.totalPool > 0 ? formatCurrency(stats.totalPool) : "No pool yet",
      isLive,
    };
  }
  return {
    primary: `${stats.totalMarkets} total`,
    secondary: "Settled",
    isLive,
  };
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 48,
    height: 48,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    borderWidth: 2,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    flex: 1,
    minWidth: 0,
  },
  liveDot: {
    width: 8,
    height: 8,
  },
});
