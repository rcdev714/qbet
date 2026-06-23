import { ActivityBetCard } from "@/components/social/ActivityBetCard";
import { ActivityCommentCard } from "@/components/social/ActivityCommentCard";
import { ActivityGroupCard } from "@/components/social/ActivityGroupCard";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { FollowingActivity } from "@/services/social.service";
import { useRouter } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";

interface ActivityFeedRowProps {
  item: FollowingActivity;
}

export function ActivityFeedRow({ item }: ActivityFeedRowProps) {
  const router = useRouter();
  const { t, i18n } = useTranslation("social");
  const relativeTime = formatRelativeTime(item.created_at, t, i18n.language);

  const handleCopyBet = () => {
    if (!item.market_id) return;
    router.push({
      pathname: "/market/[id]",
      params: {
        id: item.market_id,
        ...(item.side ? { side: item.side } : {}),
        ...(item.bet_amount ? { previewAmount: String(item.bet_amount) } : {}),
      },
    } as any);
  };

  switch (item.activity_type) {
    case "bet_placed":
    case "bet_won":
    case "bet_lost":
      return (
        <ActivityBetCard
          item={item}
          relativeTime={relativeTime}
          onCopyBet={item.activity_type === "bet_placed" ? handleCopyBet : undefined}
        />
      );
    case "market_comment":
      return <ActivityCommentCard item={item} relativeTime={relativeTime} />;
    case "group_created":
    case "group_joined":
      return <ActivityGroupCard item={item} relativeTime={relativeTime} />;
    default:
      return (
        <ActivityBetCard item={item} relativeTime={relativeTime} />
      );
  }
}
