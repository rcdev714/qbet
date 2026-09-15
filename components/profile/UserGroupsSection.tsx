import { useGroupNavigation } from "@/hooks/useGroupNavigation";
import { useRouter } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { GroupJoinButton } from "@/components/social/GroupJoinButton";
import { UserAvatar } from "@/components/social/UserAvatar";
import { AppText } from "@/components/ui/AppText";
import { useTheme } from "@/contexts/ThemeContext";
import { AdministeredGroup, ProfileGroup, groupService } from "@/services/group.service";

interface UserGroupsSectionProps {
  userId: string;
  isOwnProfile?: boolean;
}

export function UserGroupsSection({ userId, isOwnProfile = false }: UserGroupsSectionProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const { openGroup } = useGroupNavigation();
  const { t } = useTranslation("social");
  const [groups, setGroups] = React.useState<(ProfileGroup | AdministeredGroup)[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    if (isOwnProfile) {
      setGroups(await groupService.getAdministeredGroups());
    } else {
      setGroups(await groupService.getProfileGroups(userId));
    }
    setLoading(false);
  }, [isOwnProfile, userId]);

  React.useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (groups.length === 0) {
    return (
      <View style={styles.empty}>
        <AppText variant="bodySm" color="secondary">
          {isOwnProfile ? t("groupsEmptyOwn") : t("groupsEmptyOther")}
        </AppText>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {groups.map((group) => (
        <Pressable
          key={group.group_id}
          style={[styles.row, { borderBottomColor: theme.border }]}
          onPress={() => openGroup(group.group_id)}
        >
          <UserAvatar uri={group.avatar_url} username={group.name ?? "G"} size={44} />
          <View style={styles.meta}>
            <AppText variant="body" style={styles.name} numberOfLines={1}>
              {group.name}
            </AppText>
            {group.description ? (
              <AppText variant="caption" color="secondary" numberOfLines={2}>
                {group.description}
              </AppText>
            ) : null}
            <AppText variant="caption" color="secondary">
              {t("groupStats", {
                members: group.member_count,
                markets: group.active_market_count,
              })}
            </AppText>
          </View>
          {group.is_member ? (
            <AppText variant="caption" color="primary">
              {t("groupMember")}
            </AppText>
          ) : (
            <GroupJoinButton groupId={group.group_id} size="sm" onJoined={load} />
          )}
        </Pressable>
      ))}
      {isOwnProfile ? (
        <AppText
          variant="caption"
          color="primary"
          style={styles.manageLink}
          onPress={() => router.push("/settings/groups" as any)}>
          {t("manageGroupsSettings")}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { padding: 24, alignItems: "center" },
  empty: { padding: 24 },
  list: { paddingHorizontal: 16, paddingBottom: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  meta: { flex: 1, gap: 2 },
  name: { fontWeight: '400' },
  manageLink: { marginTop: 12, fontWeight: '400' },
});
