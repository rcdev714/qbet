import { AuraBadge } from "@/components/profile/AuraBadge";
import { UserAvatar } from "@/components/social/UserAvatar";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { AppText } from "@/components/ui/AppText";
import { useTheme } from "@/contexts/ThemeContext";
import { formatCurrency } from "@/lib/parimutuel";
import { FollowingActivity } from "@/services/social.service";
import { useRouter } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

interface ActivityBetCardProps {
  item: FollowingActivity;
  relativeTime: string;
  onCopyBet?: () => void;
}

export function ActivityBetCard({ item, relativeTime, onCopyBet }: ActivityBetCardProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const { t } = useTranslation("social");

  const isWin = item.activity_type === "bet_won";
  const isLoss = item.activity_type === "bet_lost";
  const side = item.side?.toUpperCase() ?? "";

  const openProfile = () => router.push(`/profile/${item.user_id}` as any);
  const openMarket = () => {
    if (item.market_id) router.push(`/market/${item.market_id}` as any);
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

      <Pressable onPress={openMarket}>
        <View style={styles.body}>
          {item.activity_type === "bet_placed" && side ? (
            <View style={[styles.sidePill, { backgroundColor: side === "YES" ? theme.marketYes : theme.marketNo }]}>
              <AppText variant="caption" style={styles.sidePillText}>
                {side}
                {item.bet_amount != null ? ` · ${formatCurrency(item.bet_amount)}` : ""}
              </AppText>
            </View>
          ) : null}

          {(isWin || isLoss) && (
            <View
              style={[
                styles.outcomePill,
                { backgroundColor: isWin ? "rgba(34, 197, 94, 0.15)" : "rgba(220, 38, 38, 0.12)" },
              ]}
            >
              <AppText variant="caption" style={{ color: isWin ? theme.success : theme.error }}>
                {isWin ? t("activityWon") : t("activityLost")}
                {item.profit_loss != null
                  ? ` ${item.profit_loss >= 0 ? "+" : ""}${formatCurrency(item.profit_loss)}`
                  : ""}
              </AppText>
            </View>
          )}

          <AppText variant="body" numberOfLines={2}>
            {item.market_question}
          </AppText>

          {item.market_yes_pct != null && item.activity_type === "bet_placed" ? (
            <AppText variant="caption" color="secondary">
              {Math.round(Number(item.market_yes_pct))}% chance
            </AppText>
          ) : null}

          {item.group_name ? (
            <AppText variant="caption" color="secondary">
              {item.group_name}
            </AppText>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.actions}>
        <AppButton title={t("viewMarket")} variant="secondary" size="sm" onPress={openMarket} />
        {item.activity_type === "bet_placed" && item.market_id && onCopyBet ? (
          <AppButton title={t("copyBet")} variant="primary" size="sm" onPress={onCopyBet} />
        ) : null}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 12, gap: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  actor: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  actorMeta: { gap: 4 },
  username: { fontWeight: "600" },
  body: { gap: 8 },
  sidePill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sidePillText: { color: "#fff", fontWeight: "600" },
  outcomePill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  actions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
});
