import React from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

export type ProfileTab = "activity" | "open" | "closed" | "stats" | "groups";

interface ProfileTabsProps {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  /** Omitted entirely. A hidden section is not a locked empty tab. */
  hiddenTabs?: ProfileTab[];
}

export function ProfileTabs({ activeTab, onTabChange, hiddenTabs = [] }: ProfileTabsProps) {
  const { theme } = useTheme();
  const { t } = useTranslation("social");

  const tabs = (
    [
      { key: "activity" as const, label: t("tabActivity") },
      { key: "stats" as const, label: t("tabStats") },
      { key: "groups" as const, label: t("tabGroups") },
      { key: "open" as const, label: t("tabOpenBets") },
      { key: "closed" as const, label: t("tabHistory") },
    ] satisfies { key: ProfileTab; label: string }[]
  ).filter((tab) => !hiddenTabs.includes(tab.key));

  return (
    <View
      style={[styles.container, { borderBottomColor: theme.border }]}
      accessibilityRole="tablist">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {tabs.map((tab) => {
          const selected = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                selected && { borderBottomColor: theme.text },
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={tab.label}
              onPress={() => onTabChange(tab.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: selected ? theme.text : theme.textSecondary },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row",
    paddingHorizontal: 8,
  },
  tab: {
    minHeight: 48,
    minWidth: 88,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    ...(Platform.OS === "web" ? { cursor: "pointer" } as any : {}),
  },
  tabText: {
    fontSize: 14,
    fontWeight: '400',
  },
});
