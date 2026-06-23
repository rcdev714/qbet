import { UserAvatar } from "@/components/social/UserAvatar";
import { AppText } from "@/components/ui/AppText";
import { useTheme } from "@/contexts/ThemeContext";
import type { MarketSocialProof } from "@/services/social.service";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

interface SocialProofStripProps {
  proof: MarketSocialProof | null;
}

export function SocialProofStrip({ proof }: SocialProofStripProps) {
  const { theme } = useTheme();
  const { t } = useTranslation("social");

  if (!proof || proof.total_followed === 0) return null;

  const yesCount = proof.followed_bettors.filter((b) => b.side === "yes").length;
  const label =
    yesCount > 0
      ? t("socialProofYes", { count: proof.total_followed })
      : t("socialProofAny", { count: proof.total_followed });

  return (
    <View style={[styles.strip, { backgroundColor: theme.primarySoft }]}>
      <View style={styles.avatars}>
        {proof.followed_bettors.slice(0, 3).map((bettor) => (
          <View key={bettor.user_id} style={styles.avatarWrap}>
            <UserAvatar uri={bettor.avatar_url} username={bettor.username} size={20} />
          </View>
        ))}
      </View>
      <AppText variant="caption" style={{ color: theme.primary, flex: 1 }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  avatars: {
    flexDirection: "row",
  },
  avatarWrap: {
    marginLeft: -4,
  },
});
