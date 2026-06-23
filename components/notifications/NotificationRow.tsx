import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { formatRelativeTime as formatRelativeTimeLabel } from "@/lib/formatRelativeTime";
import { Notification } from "@/services/notification.service";

type ThemeColors = {
  text: string;
  textSecondary: string;
  surface: string;
  border: string;
  primary: string;
  primarySoft: string;
};

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  bet_won: "trophy",
  bet_lost: "stats-chart",
  market_resolved: "checkmark-circle",
  new_follower: "person-add",
  group_invite: "mail",
  group_invite_accepted: "checkmark-circle",
  beta_approved: "star",
};

interface NotificationRowProps {
  notification: Notification;
  theme: ThemeColors;
  onPress: () => void;
}

export function NotificationRow({ notification, theme, onPress }: NotificationRowProps) {
  const { t } = useTranslation("social");
  const unread = !notification.read_at;
  const icon = TYPE_ICONS[notification.type] ?? "notifications";
  const summary = [notification.title, notification.body].filter(Boolean).join(". ");
  const accessibilityLabel = unread
    ? t("notificationUnread", { title: summary })
    : t("notificationRead", { title: summary });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: unread }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: unread ? theme.primarySoft : theme.surface,
          borderBottomColor: theme.border,
          opacity: pressed ? 0.85 : 1,
        },
        Platform.OS === "web" && ({ cursor: "pointer" } as any),
      ]}
    >
      <View
        style={[styles.iconWrap, { backgroundColor: theme.surface }]}
        accessibilityElementsHidden
      >
        <Ionicons name={icon} size={20} color={theme.primary} />
      </View>
      <View style={styles.content} accessibilityElementsHidden>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
          {notification.title}
        </Text>
        {notification.body ? (
          <Text style={[styles.body, { color: theme.textSecondary }]} numberOfLines={2}>
            {notification.body}
          </Text>
        ) : null}
        <Text style={[styles.time, { color: theme.textSecondary }]}>
          {formatRelativeTimeLabel(notification.created_at, t)}
        </Text>
      </View>
      {unread ? (
        <View
          style={[styles.dot, { backgroundColor: theme.primary }]}
          accessibilityElementsHidden
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
    minHeight: 72,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "400",
    marginBottom: 2,
  },
  body: {
    fontSize: 13,
    marginBottom: 4,
  },
  time: {
    fontSize: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
});
