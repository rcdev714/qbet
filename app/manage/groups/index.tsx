import { Redirect, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { AnymarktLoader } from "@/components/AnymarktLoader";
import { AppText } from "@/components/ui/AppText";
import { useIsDesktopWebNav } from "@/contexts/NavigationLayoutContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useGroupAdminConsole } from "@/hooks/useGroupAdminConsole";
import { GroupAdminListScreen } from "@/screens/GroupAdminListScreen";

function ManageGroupsPlaceholder() {
  const { theme } = useTheme();
  return (
    <View style={[styles.placeholder, { backgroundColor: theme.background }]}>
      <AppText variant="bodySm" color="secondary">
        Select a group to manage
      </AppText>
    </View>
  );
}

export default function ManageGroupsIndex() {
  const isDesktop = useIsDesktopWebNav();
  const router = useRouter();
  const { groups, loading, refreshing, refresh, hasAcknowledgment, setRefreshing } =
    useGroupAdminConsole();

  useEffect(() => {
    if (loading || hasAcknowledgment === null) return;
    if (!hasAcknowledgment) {
      router.replace("/manage/groups/disclaimer" as never);
    }
  }, [hasAcknowledgment, loading, router]);

  if (loading || hasAcknowledgment === null) {
    return <AnymarktLoader />;
  }

  if (!hasAcknowledgment) {
    return <Redirect href={"/manage/groups/disclaimer" as never} />;
  }

  if (isDesktop) {
    return <ManageGroupsPlaceholder />;
  }

  return (
    <GroupAdminListScreen
      groups={groups}
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void refresh();
      }}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
});
