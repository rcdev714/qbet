import { CreateGroupModal } from "@/components/CreateGroupModal";
import { AppButton, AppCard, AppListRow, AppText } from "@/components/ui";
import { useTheme } from "@/contexts/ThemeContext";
import { useGroups } from "@/hooks/useGroups";
import type { GroupAdminConsoleGroup } from "@/types/settlement-governance";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

type GroupAdminListScreenProps = {
  groups: GroupAdminConsoleGroup[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  layout?: "standalone" | "list-pane";
  selectedGroupId?: string;
};

export function GroupAdminListScreen({
  groups,
  loading,
  refreshing,
  onRefresh,
  layout = "standalone",
  selectedGroupId,
}: GroupAdminListScreenProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const { t } = useTranslation("groupAdmin");
  const { createGroup, joinGroup, loading: groupActionLoading } = useGroups();
  const [modalVisible, setModalVisible] = useState(false);

  const openManage = (groupId: string) => {
    router.push(`/manage/groups/${groupId}` as never);
  };

  const content = (
    <>
      {layout === "standalone" ? (
        <View style={styles.headerBlock}>
          <AppText variant="title2">{t("title")}</AppText>
          <AppText variant="bodySm" color="secondary">
            {t("subtitle")}
          </AppText>
        </View>
      ) : null}

      <AppButton title={t("createGroup")} onPress={() => setModalVisible(true)} />

      {loading ? (
        <ActivityIndicator color={theme.primary} style={styles.loader} />
      ) : groups.length === 0 ? (
        <AppText variant="bodySm" color="secondary">
          {t("emptyBody")}
        </AppText>
      ) : (
        groups.map((group) => (
          <AppCard key={group.group_id} padded={false}>
            <AppListRow
              title={group.name ?? t("title")}
              subtitle={`${group.member_count} ${t("memberCount")} · ${group.active_market_count} ${t("openPredictions")}`}
              chevron
              onPress={() => openManage(group.group_id)}
            />
            {(group.pending_dispute_count ?? 0) > 0 ? (
              <AppText variant="caption" color="secondary" style={styles.badge}>
                {group.pending_dispute_count} {t("pendingDisputes")}
              </AppText>
            ) : null}
          </AppCard>
        ))
      )}

      <CreateGroupModal
        visible={modalVisible}
        loading={groupActionLoading}
        onClose={() => setModalVisible(false)}
        onCreate={async (name, description) => {
          const { group, error } = await createGroup(name, description);
          if (error || !group) return;
          setModalVisible(false);
          onRefresh();
          openManage(group.id);
        }}
        onJoin={async (code) => {
          const { error } = await joinGroup(code);
          if (!error) {
            setModalVisible(false);
            onRefresh();
          }
        }}
      />
    </>
  );

  if (layout === "list-pane") {
    return (
      <ScrollView
        contentContainerStyle={styles.listPaneContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {content}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
      }
    >
      {content}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  listPaneContent: { padding: 12, gap: 10, paddingBottom: 24 },
  headerBlock: { gap: 4, marginBottom: 4 },
  loader: { marginTop: 24 },
  badge: { paddingHorizontal: 14, paddingBottom: 10 },
});
