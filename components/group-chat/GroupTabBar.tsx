import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { resolveGutter } from "@/constants/layout";
import { useIsDesktopWebNav } from "@/contexts/NavigationLayoutContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useWindowDimensions } from "react-native";

export type GroupTab = "chat" | "active" | "history" | "rankings";

interface GroupTabBarProps {
  activeTab: GroupTab;
  onTabChange: (tab: GroupTab) => void;
  openCount?: number;
}

export function GroupTabBar({ activeTab, onTabChange, openCount }: GroupTabBarProps) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktopWebNav = useIsDesktopWebNav();
  const gutter = isDesktopWebNav ? 16 : resolveGutter(width);

  const segments = useMemo(
    () =>
      [
        { value: "chat" as const, label: "Chat", testID: "group-tab-chat" },
        {
          value: "active" as const,
          label: openCount && openCount > 0 ? `Active (${openCount > 9 ? "9+" : openCount})` : "Active",
          testID: "group-tab-active",
        },
        { value: "history" as const, label: "History", testID: "group-tab-history" },
        { value: "rankings" as const, label: "Rankings", testID: "group-tab-rankings" },
      ] as const,
    [openCount],
  );

  return (
    <View
      style={[
        styles.container,
        {
          paddingHorizontal: gutter,
          backgroundColor: theme.surface,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <SegmentedControl compact value={activeTab} segments={[...segments]} onChange={onTabChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
