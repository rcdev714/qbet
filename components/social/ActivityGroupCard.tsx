import { GroupJoinButton } from "@/components/social/GroupJoinButton";
import { UserAvatar } from "@/components/social/UserAvatar";
import { AppCard } from "@/components/ui/AppCard";
import { AppText } from "@/components/ui/AppText";
import { FollowingActivity } from "@/services/social.service";
import { useGroupNavigation } from "@/hooks/useGroupNavigation";
import { useRouter } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

interface ActivityGroupCardProps {
  item: FollowingActivity;
  relativeTime: string;
}

export function ActivityGroupCard({ item, relativeTime }: ActivityGroupCardProps) {
  const router = useRouter();
  const { openGroup: navigateToGroup } = useGroupNavigation();
  const { t } = useTranslation("social");

  const openProfile = () => router.push(`/profile/${item.user_id}` as any);
  const openGroup = () => {
    if (item.group_id) navigateToGroup(item.group_id);
  };

  const actionLabel =
    item.activity_type === "group_created" ? t("activityGroupCreated") : t("activityGroupJoined");

  return (
    <AppCard style={styles.card}>
      <View style={styles.header}>
        <Pressable style={styles.actor} onPress={openProfile}>
          <UserAvatar uri={item.avatar_url} username={item.username} size={40} />
          <View style={styles.actorMeta}>
            <AppText variant="bodySm" style={styles.username}>
              @{item.username}
            </AppText>
            <AppText variant="caption" color="secondary">
              {actionLabel}
            </AppText>
          </View>
        </Pressable>
        <AppText variant="caption" color="secondary">
          {relativeTime}
        </AppText>
      </View>

      <Pressable onPress={openGroup}>
        <AppText variant="body" style={styles.groupName}>
          {item.group_name}
        </AppText>
      </Pressable>

      {item.group_id && !item.is_member ? (
        <GroupJoinButton groupId={item.group_id} size="sm" />
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 12, gap: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  actor: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  actorMeta: { gap: 2 },
  username: { fontWeight: "600" },
  groupName: { fontWeight: "500" },
});
