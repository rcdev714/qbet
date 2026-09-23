import { SocialPostCard } from "@/components/social/SocialPostCard";
import type { FollowingActivity } from "@/services/social.service";
import React from "react";

interface ActivityFeedRowProps {
  item: FollowingActivity;
}

export function ActivityFeedRow({ item }: ActivityFeedRowProps) {
  return <SocialPostCard item={item} />;
}
