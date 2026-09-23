import { GroupJoinButton } from "@/components/social/GroupJoinButton";
import { UserAvatar } from "@/components/social/UserAvatar";
import { AppButton } from "@/components/ui/AppButton";
import { AppIconButton } from "@/components/ui/AppIconButton";
import { AppText } from "@/components/ui/AppText";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/ThemeContext";
import { useGroupNavigation } from "@/hooks/useGroupNavigation";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { likeService } from "@/services/like.service";
import { shareService } from "@/services/share.service";
import type { FollowingActivity } from "@/services/social.service";
import type { Market } from "@/types/market";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

interface SocialPostCardProps {
  item: FollowingActivity;
}

function oddsPercents(yesPct: number | null | undefined): { yes: number; no: number } | null {
  if (yesPct == null || Number.isNaN(Number(yesPct))) return null;
  const yes = Math.max(0, Math.min(100, Math.round(Number(yesPct))));
  return { yes, no: 100 - yes };
}

export function SocialPostCard({ item }: SocialPostCardProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const { openGroup } = useGroupNavigation();
  const { t, i18n } = useTranslation("social");
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [likeBusy, setLikeBusy] = useState(false);

  const relativeTime = formatRelativeTime(item.created_at, t, i18n.language);
  const odds = oddsPercents(item.market_yes_pct);
  const hasMarket = Boolean(item.market_id);
  const handle = item.username?.trim() || "someone";

  useEffect(() => {
    if (!item.market_id) return;
    let cancelled = false;
    void Promise.all([
      likeService.getSocialStats(item.market_id),
      likeService.hasLiked(item.market_id),
    ]).then(([stats, hasLiked]) => {
      if (cancelled) return;
      setLikeCount(stats.likeCount);
      setCommentCount(stats.commentCount);
      setLiked(hasLiked);
    });
    return () => {
      cancelled = true;
    };
  }, [item.market_id]);

  const verb = (() => {
    switch (item.activity_type) {
      case "bet_placed":
        return t("verbBet", { side: (item.side ?? "").toUpperCase() });
      case "bet_won":
        return t("verbWon");
      case "bet_lost":
        return t("verbLost");
      case "market_comment":
        return t("verbComment");
      case "group_created":
        return t("verbGroupCreated");
      case "group_joined":
        return t("verbGroupJoined");
      case "market_posted":
        return t("verbPosted");
      default:
        return t("verbPosted");
    }
  })();

  const openProfile = () => router.push(`/profile/${item.user_id}` as never);
  const openMarket = (side?: string) => {
    if (!item.market_id) return;
    router.push({
      pathname: "/market/[id]",
      params: {
        id: item.market_id,
        ...(side ? { side } : {}),
      },
    } as never);
  };
  const openComment = () => {
    if (!item.market_id) return;
    router.push(`/market/${item.market_id}?tab=chat` as never);
  };

  const onLike = async () => {
    if (!item.market_id || likeBusy) return;
    setLikeBusy(true);
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((count) => Math.max(0, count + (nextLiked ? 1 : -1)));
    const result = await likeService.toggleLike(item.market_id);
    setLikeBusy(false);
    if (result.error) {
      setLiked(!nextLiked);
      setLikeCount((count) => Math.max(0, count + (nextLiked ? -1 : 1)));
      return;
    }
    setLiked(result.liked);
    setLikeCount(result.count);
  };

  const onShare = async () => {
    if (!item.market_id) return;
    await shareService.shareMarket({
      id: item.market_id,
      question: item.market_question ?? "",
      group_id: item.group_id ?? null,
    } as Market);
  };

  const body = item.activity_type === "market_comment"
    ? item.comment_preview
    : item.market_question || item.group_name;

  return (
    <View
      testID="social-post-card"
      style={[styles.card, { borderBottomColor: theme.border, backgroundColor: theme.background }]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={openProfile}
          accessibilityRole="button"
          accessibilityLabel={t("viewProfile", { username: handle })}
          style={styles.actor}
        >
          <UserAvatar uri={item.avatar_url} username={handle} size={44} />
          <View style={styles.actorMeta}>
            <AppText variant="bodySm" numberOfLines={1}>
              @{handle}
            </AppText>
            <AppText variant="caption" color="secondary" numberOfLines={1}>
              {verb}
            </AppText>
          </View>
        </Pressable>
        <AppText variant="caption" color="secondary">
          {relativeTime}
        </AppText>
      </View>

      {body ? (
        <Pressable
          onPress={() => (hasMarket ? openMarket(item.side ?? undefined) : item.group_id && openGroup(item.group_id))}
          accessibilityRole="button"
          accessibilityLabel={
            hasMarket
              ? t("activityOpenMarket", { market: body })
              : t("openGroupA11y", { group: item.group_name ?? "" })
          }
        >
          <AppText variant="body">{body}</AppText>
        </Pressable>
      ) : null}

      {item.activity_type === "market_comment" && item.market_question ? (
        <AppText variant="bodySm" color="secondary" numberOfLines={2}>
          {item.market_question}
        </AppText>
      ) : null}

      {odds && hasMarket ? (
        <View style={styles.oddsRow}>
          <Pressable
            onPress={() => openMarket("yes")}
            accessibilityRole="button"
            accessibilityLabel={t("oddsYesA11y", { percent: odds.yes })}
            style={[styles.oddsChip, { borderColor: theme.border, backgroundColor: theme.surface, borderRadius: theme.radius.pill }]}
          >
            <AppText variant="label">{t("oddsYes", { percent: odds.yes })}</AppText>
          </Pressable>
          <Pressable
            onPress={() => openMarket("no")}
            accessibilityRole="button"
            accessibilityLabel={t("oddsNoA11y", { percent: odds.no })}
            style={[styles.oddsChip, { borderColor: theme.border, backgroundColor: theme.surface, borderRadius: theme.radius.pill }]}
          >
            <AppText variant="label">{t("oddsNo", { percent: odds.no })}</AppText>
          </Pressable>
        </View>
      ) : null}

      {hasMarket ? (
        <View style={styles.actions} testID="social-post-actions">
          <View style={styles.actionCluster}>
            <AppIconButton
              variant="ghost"
              accessibilityLabel={liked ? t("actionUnlike") : t("actionLike")}
              icon={
                <IconSymbol
                  name={liked ? "heart.fill" : "heart"}
                  size={22}
                  color={liked ? theme.primary : theme.textSecondary}
                />
              }
              onPress={() => void onLike()}
              disabled={likeBusy}
            />
            <AppText variant="caption" color="secondary">
              {likeCount}
            </AppText>
            <AppIconButton
              variant="ghost"
              accessibilityLabel={t("actionComment")}
              icon={<IconSymbol name="bubble.left.fill" size={20} color={theme.textSecondary} />}
              onPress={openComment}
            />
            <AppText variant="caption" color="secondary">
              {commentCount}
            </AppText>
            <AppIconButton
              variant="ghost"
              accessibilityLabel={t("actionShare")}
              icon={<IconSymbol name="arrowshape.turn.up.right.fill" size={20} color={theme.textSecondary} />}
              onPress={() => void onShare()}
            />
          </View>
          <AppButton title={t("actionBet")} size="sm" onPress={() => openMarket(item.side ?? undefined)} />
        </View>
      ) : item.group_id ? (
        <View style={styles.actions}>
          {!item.is_member ? <GroupJoinButton groupId={item.group_id} size="sm" /> : null}
          <AppButton title={t("openGroupAction")} variant="secondary" size="sm" onPress={() => openGroup(item.group_id!)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  actor: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minHeight: 44,
  },
  actorMeta: {
    flex: 1,
    gap: 2,
  },
  oddsRow: {
    flexDirection: "row",
    gap: 8,
  },
  oddsChip: {
    flex: 1,
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  actionCluster: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
});
