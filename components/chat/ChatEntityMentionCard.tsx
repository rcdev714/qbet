import { GroupJoinButton } from "@/components/social/GroupJoinButton";
import { UserAvatar } from "@/components/social/UserAvatar";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppCard } from "@/components/ui/AppCard";
import { AppSkeleton } from "@/components/ui/AppSkeleton";
import { AppText } from "@/components/ui/AppText";
import { useTheme } from "@/contexts/ThemeContext";
import { formatCurrency } from "@/lib/parimutuel";
import type { MentionBetCard, MentionGroupCard, MentionProfileCard } from "@/types/mention";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, View } from "react-native";

type ChatEntityMentionCardProps =
  | {
      variant: "group";
      data: MentionGroupCard | null;
      loading?: boolean;
    }
  | {
      variant: "profile";
      data: MentionProfileCard | null;
      loading?: boolean;
    }
  | {
      variant: "bet";
      data: MentionBetCard | null;
      loading?: boolean;
    };

export function ChatEntityMentionCard(props: ChatEntityMentionCardProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const { t } = useTranslation("groups");

  if (props.loading || !props.data) {
    return <AppSkeleton height={120} style={styles.skeleton} />;
  }

  if (props.variant === "group") {
    const data = props.data;
    const openGroup = () => router.push(`/group/${data.group_id}` as any);

    return (
      <Pressable
        onPress={openGroup}
        style={[styles.wrapper, Platform.OS === "web" && ({ cursor: "pointer" } as const)]}
        accessibilityRole="button"
        accessibilityLabel={t("mentionViewGroup", { name: data.name ?? t("mentionGroupFallback") })}
      >
        <AppCard style={[styles.card, { borderColor: theme.border }]}>
          {data.avatar_url ? (
            <Image source={{ uri: data.avatar_url }} style={styles.headerImage} contentFit="cover" />
          ) : (
            <View style={[styles.headerImage, { backgroundColor: theme.primarySoft }]} />
          )}
          <View style={styles.body}>
            <AppText variant="body" style={styles.title} numberOfLines={2}>
              {data.name ?? t("mentionGroupFallback")}
            </AppText>
            <AppText variant="caption" color="secondary">
              {t("mentionGroupMembers", { count: data.member_count })}
            </AppText>
            {data.invite_code ? (
              <AppBadge label={t("mentionInviteCode", { code: data.invite_code })} />
            ) : null}
            {!data.is_member ? (
              <GroupJoinButton groupId={data.group_id} size="sm" />
            ) : null}
          </View>
        </AppCard>
      </Pressable>
    );
  }

  if (props.variant === "profile") {
    const data = props.data;
    const openProfile = () => router.push(`/profile/${data.user_id}` as any);

    return (
      <Pressable
        onPress={openProfile}
        style={[styles.wrapper, Platform.OS === "web" && ({ cursor: "pointer" } as const)]}
        accessibilityRole="button"
        accessibilityLabel={t("mentionViewProfile", { username: data.username ?? "user" })}
      >
        <AppCard style={[styles.card, styles.profileCard, { borderColor: theme.border }]}>
          <UserAvatar uri={data.avatar_url} username={data.username} size={48} />
          <View style={styles.body}>
            <AppText variant="body" style={styles.title}>
              @{data.username}
            </AppText>
            <AppText variant="caption" color="secondary">
              {t("mentionProfileStats", {
                winRate: Math.round((data.win_rate ?? 0) * 100),
                followers: data.followers_count ?? 0,
              })}
            </AppText>
          </View>
        </AppCard>
      </Pressable>
    );
  }

  const data = props.data;
  const side = (data.side ?? "").toUpperCase();
  const openMarket = () => {
    router.push({
      pathname: "/market/[id]",
      params: {
        id: data.market_id,
        ...(side ? { side: side.toLowerCase() } : {}),
        previewAmount: String(data.amount),
      },
    } as any);
  };

  return (
    <Pressable
      onPress={openMarket}
      style={[styles.wrapper, Platform.OS === "web" && ({ cursor: "pointer" } as const)]}
      accessibilityRole="button"
      accessibilityLabel={t("mentionCopyBet")}
    >
      <AppCard style={[styles.card, { borderColor: theme.border }]}>
        {data.market_image_url ? (
          <Image source={{ uri: data.market_image_url }} style={styles.headerImage} contentFit="cover" />
        ) : null}
        <View style={styles.body}>
          <View style={styles.betHeader}>
            <UserAvatar uri={data.avatar_url} username={data.username} size={28} />
            <AppText variant="bodySm" style={styles.username}>
              @{data.username}
            </AppText>
            {side ? (
              <View
                style={[
                  styles.sidePill,
                  { backgroundColor: side === "YES" ? theme.marketYes : theme.marketNo },
                ]}
              >
                <AppText variant="caption" style={styles.sidePillText}>
                  {side} · {formatCurrency(data.amount)}
                </AppText>
              </View>
            ) : null}
          </View>
          <AppText variant="body" numberOfLines={2}>
            {data.market_question}
          </AppText>
        </View>
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    maxWidth: "75%",
    alignSelf: "flex-start",
  },
  skeleton: {
    maxWidth: "75%",
    alignSelf: "flex-start",
    borderRadius: 16,
  },
  card: {
    overflow: "hidden",
    padding: 0,
    gap: 0,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  headerImage: {
    width: "100%",
    height: 88,
  },
  body: {
    padding: 12,
    gap: 6,
  },
  title: {
    fontWeight: "600",
  },
  username: {
    fontWeight: "600",
    flex: 1,
  },
  betHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sidePill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sidePillText: {
    color: "#fff",
    fontWeight: "600",
  },
});
