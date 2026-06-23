import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    RefreshControl,
    StyleSheet,
    Switch,
    View,
} from "react-native";

import { JoinGroupPanel } from "@/components/groups/JoinGroupPanel";
import { SettingsScreenLayout } from "@/components/settings/SettingsScreenLayout";
import { AppCard } from "@/components/ui/AppCard";
import { AppListRow } from "@/components/ui/AppListRow";
import { AppText } from "@/components/ui/AppText";
import { useTheme } from "@/contexts/ThemeContext";
import { AdministeredGroup, groupService } from "@/services/group.service";

export default function SettingsGroupsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { t } = useTranslation("settings");
  const [groups, setGroups] = useState<AdministeredGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await groupService.getAdministeredGroups();
    setGroups(data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleVisibility = async (
    groupId: string,
    patch: { is_discoverable?: boolean; show_on_profile?: boolean },
  ) => {
    setSavingId(groupId);
    await groupService.updateGroupVisibility(groupId, patch);
    await load();
    setSavingId(null);
  };

  return (
    <SettingsScreenLayout
      title={t("groupsTitle")}
      showBack
      scrollProps={{
        contentContainerStyle: styles.content,
        refreshControl: (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={theme.primary}
          />
        ),
      }}
    >
      <JoinGroupPanel collapsible={false} onJoined={load} />

      {loading ? (
        <ActivityIndicator color={theme.primary} style={styles.loader} />
      ) : groups.length === 0 ? (
        <AppText variant="bodySm" color="secondary">
          {t("groupsAdminEmpty")}
        </AppText>
      ) : (
        groups.map((group) => (
          <AppCard key={group.group_id} padded={false} style={styles.groupCard}>
            <AppListRow
              title={group.name ?? t("groupsTitle")}
              subtitle={t("groupStatsShort", {
                members: group.member_count,
                markets: group.active_market_count,
              })}
              chevron
              onPress={() => router.push(`/group/${group.group_id}` as any)}
            />
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <AppText variant="bodySm">{t("groupDiscoverable")}</AppText>
                <AppText variant="caption" color="secondary">
                  {t("groupDiscoverableHint")}
                </AppText>
              </View>
              <Switch
                value={group.is_discoverable}
                disabled={savingId === group.group_id}
                onValueChange={(v) => toggleVisibility(group.group_id, { is_discoverable: v })}
                accessibilityLabel={t("groupDiscoverable")}
                accessibilityHint={t("groupDiscoverableHint")}
                trackColor={{ false: theme.border, true: theme.primary }}
              />
            </View>
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <AppText variant="bodySm">{t("groupShowOnProfile")}</AppText>
                <AppText variant="caption" color="secondary">
                  {t("groupShowOnProfileHint")}
                </AppText>
              </View>
              <Switch
                value={group.show_on_profile}
                disabled={savingId === group.group_id}
                onValueChange={(v) => toggleVisibility(group.group_id, { show_on_profile: v })}
                accessibilityLabel={t("groupShowOnProfile")}
                accessibilityHint={t("groupShowOnProfileHint")}
                trackColor={{ false: theme.border, true: theme.primary }}
              />
            </View>
          </AppCard>
        ))
      )}
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14 },
  loader: { marginTop: 24 },
  groupCard: {
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    minHeight: 44,
  },
  toggleText: {
    flex: 1,
    paddingRight: 12,
    gap: 2,
  },
});
