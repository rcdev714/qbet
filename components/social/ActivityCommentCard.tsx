import { AuraBadge } from "@/components/profile/AuraBadge";
import { UserAvatar } from "@/components/social/UserAvatar";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { AppText } from "@/components/ui/AppText";
import { useTheme } from "@/contexts/ThemeContext";
import { FollowingActivity } from "@/services/social.service";
import { useRouter } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

interface ActivityCommentCardProps {
  item: FollowingActivity;
  relativeTime: string;
}

export function ActivityCommentCard({ item, relativeTime }: ActivityCommentCardProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const { t } = useTranslation("social");

  const openProfile = () => router.push(`/profile/${item.user_id}` as any);
  const openChat = () => {
    if (item.market_id) router.push(`/market/${item.market_id}?tab=chat` as any);
  };

  return (
    <AppCard style={styles.card}>
      <View style={styles.header}>
        <Pressable style={styles.actor} onPress={openProfile}>
          <UserAvatar uri={item.avatar_url} username={item.username} size={40} />
          <View style={styles.actorMeta}>
            <AppText variant="bodySm" style={styles.username}>
              @{item.username}
            </AppText>
            {item.actor_win_rate != null ? (
              <AuraBadge winRate={item.actor_win_rate} compact />
            ) : null}
          </View>
        </Pressable>
        <AppText variant="caption" color="secondary">
          {relativeTime}
        </AppText>
      </View>

      <AppText variant="bodySm" color="secondary" numberOfLines={1}>
        {item.market_question}
      </AppText>

      <View style={[styles.quote, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <AppText variant="bodySm" numberOfLines={3}>
          {`"${item.comment_preview}"`}
        </AppText>
      </View>

      <AppButton title={t("joinChat")} variant="secondary" size="sm" onPress={openChat} />
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 12, gap: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  actor: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  actorMeta: { gap: 4 },
  username: { fontWeight: "600" },
  quote: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
  },
});
