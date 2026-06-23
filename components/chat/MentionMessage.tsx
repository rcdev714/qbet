import { ChatEntityMentionCard } from "@/components/chat/ChatEntityMentionCard";
import { mentionService } from "@/services/mention.service";
import type { MentionBetCard, MentionGroupCard, MentionProfileCard } from "@/types/mention";
import React, { useEffect, useState } from "react";

type MentionMessageProps =
  | { variant: "group"; id: string }
  | { variant: "profile"; id: string }
  | { variant: "bet"; id: string };

export function MentionMessage({ variant, id }: MentionMessageProps) {
  const [loading, setLoading] = useState(true);
  const [groupData, setGroupData] = useState<MentionGroupCard | null>(null);
  const [profileData, setProfileData] = useState<MentionProfileCard | null>(null);
  const [betData, setBetData] = useState<MentionBetCard | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    const load = async () => {
      if (variant === "group") {
        const data = await mentionService.fetchGroupCard(id);
        if (mounted) setGroupData(data);
      } else if (variant === "profile") {
        const data = await mentionService.fetchProfileCard(id);
        if (mounted) setProfileData(data);
      } else {
        const data = await mentionService.fetchBetCard(id);
        if (mounted) setBetData(data);
      }
      if (mounted) setLoading(false);
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [variant, id]);

  if (variant === "group") {
    return <ChatEntityMentionCard variant="group" data={groupData} loading={loading} />;
  }
  if (variant === "profile") {
    return <ChatEntityMentionCard variant="profile" data={profileData} loading={loading} />;
  }
  return <ChatEntityMentionCard variant="bet" data={betData} loading={loading} />;
}
