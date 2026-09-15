import { Slot, Stack, usePathname } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";

import { GROUPS_LIST_PANE_WIDTH } from "@/constants/layout";
import { useIsDesktopWebNav } from "@/contexts/NavigationLayoutContext";
import { useTheme } from "@/contexts/ThemeContext";
import { DirectMessagesScreen } from "@/screens/DirectMessagesScreen";

function useSelectedGroupIdFromPath(): string | undefined {
  const pathname = usePathname();
  const match = pathname.match(/\/groups\/([^/?#]+)/);
  return match?.[1];
}

export default function GroupsLayout() {
  const isDesktopWebNav = useIsDesktopWebNav();
  const { theme } = useTheme();
  const selectedGroupId = useSelectedGroupIdFromPath();

  if (!isDesktopWebNav) {
    return (
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { flex: 1 },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="[id]" />
      </Stack>
    );
  }

  return (
    <View
      style={[styles.root, { backgroundColor: theme.background }]}
      testID="groups-split-layout"
    >
      <View
        style={[
          styles.listPane,
          {
            width: GROUPS_LIST_PANE_WIDTH,
            borderRightColor: theme.border,
            backgroundColor: theme.background,
          },
        ]}
        testID="groups-list-pane"
      >
        <DirectMessagesScreen layout="list-pane" selectedGroupId={selectedGroupId} />
      </View>
      <View style={styles.detailPane} testID="groups-detail-pane">
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "row",
    minHeight: 0,
  },
  listPane: {
    borderRightWidth: StyleSheet.hairlineWidth,
    minHeight: 0,
  },
  detailPane: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
});
