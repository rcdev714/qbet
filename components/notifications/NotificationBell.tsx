import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { useNotifications } from "@/hooks/useNotifications";

export function NotificationBell() {
  const { theme } = useTheme();
  const router = useRouter();
  const { t } = useTranslation("social");
  const { unreadCount } = useNotifications();

  const accessibilityLabel =
    unreadCount > 0
      ? t("openNotificationsUnread", { count: unreadCount })
      : t("openNotifications");

  return (
    <Pressable
      onPress={() => router.push("/notifications")}
      style={[styles.button, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityHint={t("notificationsTitle")}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Ionicons name="notifications-outline" size={22} color={theme.text} />
      {unreadCount > 0 ? (
        <View
          style={[styles.badge, { backgroundColor: theme.primary }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={[styles.badgeText, { color: theme.onPrimary }]}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 44,
    minHeight: 44,
    padding: 8,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
});
