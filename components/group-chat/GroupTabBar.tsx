import { useTheme } from "@/contexts/ThemeContext";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type GroupTab = "chat" | "active" | "history" | "rankings";

interface GroupTabBarProps {
  activeTab: GroupTab;
  onTabChange: (tab: GroupTab) => void;
  openCount?: number;
}

const TABS: { key: GroupTab; label: string }[] = [
  { key: "chat", label: "Chat" },
  { key: "active", label: "Active" },
  { key: "history", label: "History" },
  { key: "rankings", label: "Rankings" },
];

export function GroupTabBar({ activeTab, onTabChange, openCount }: GroupTabBarProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            testID={`group-tab-${tab.key}`}
            style={[
              styles.tab,
              { backgroundColor: theme.background },
              isActive && [styles.tabActive, { backgroundColor: theme.primary }],
            ]}
            onPress={() => onTabChange(tab.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                { color: isActive ? theme.onPrimary : theme.textSecondary },
                isActive && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
            {tab.key === "active" && openCount !== undefined && openCount > 0 && (
              <View style={[styles.badge, { backgroundColor: isActive ? "rgba(255,255,255,0.24)" : theme.primary }]}>
                <Text style={[styles.badgeText, { color: theme.onPrimary }]}>{openCount > 9 ? "9+" : openCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    minHeight: 36,
    paddingVertical: 8,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  tabActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
  },
  tabTextActive: {
    fontWeight: "600",
  },
  badge: {
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
