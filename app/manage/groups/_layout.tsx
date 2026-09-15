import { Slot, Stack, usePathname } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";

import { GROUPS_LIST_PANE_WIDTH } from "@/constants/layout";
import { useIsDesktopWebNav } from "@/contexts/NavigationLayoutContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useGroupAdminConsole } from "@/hooks/useGroupAdminConsole";
import { GroupAdminListScreen } from "@/screens/GroupAdminListScreen";

function useSelectedManageGroupId(): string | undefined {
  const pathname = usePathname();
  const match = pathname.match(/\/manage\/groups\/([^/?#]+)/);
  const id = match?.[1];
  if (!id || id === "disclaimer") return undefined;
  return id;
}

export default function ManageGroupsLayout() {
  const isDesktopWebNav = useIsDesktopWebNav();
  const { theme } = useTheme();
  const selectedGroupId = useSelectedManageGroupId();
  const { groups, loading, refreshing, refresh, setRefreshing } = useGroupAdminConsole();

  if (!isDesktopWebNav) {
    return (
      <Stack screenOptions={{ headerShown: false, contentStyle: { flex: 1 } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="disclaimer" />
        <Stack.Screen name="[id]" />
      </Stack>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.listPane,
          { width: GROUPS_LIST_PANE_WIDTH, borderRightColor: theme.border },
        ]}
      >
        <GroupAdminListScreen
          layout="list-pane"
          groups={groups}
          loading={loading}
          refreshing={refreshing}
          selectedGroupId={selectedGroupId}
          onRefresh={() => {
            setRefreshing(true);
            void refresh();
          }}
        />
      </View>
      <View style={styles.detailPane}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", minHeight: 0 },
  listPane: { borderRightWidth: StyleSheet.hairlineWidth, minHeight: 0 },
  detailPane: { flex: 1, minWidth: 0, minHeight: 0 },
});
