import { GroupAdminShell, type GroupAdminTab } from "@/components/group-admin/GroupAdminShell";
import { AppCard, AppText } from "@/components/ui";
import { useTheme } from "@/contexts/ThemeContext";
import { groupService } from "@/services/group.service";
import { marketService } from "@/services/market.service";
import { resolutionService } from "@/services/resolution.service";
import { settlementGovernanceService } from "@/services/settlement-governance.service";
import type { GroupAdminConsoleGroup } from "@/types/settlement-governance";
import type { Market } from "@/types/market";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, StyleSheet, Switch, View } from "react-native";

type GroupAdminDetailScreenProps = {
  groupId: string;
  groups: GroupAdminConsoleGroup[];
};

export function GroupAdminDetailScreen({ groupId, groups }: GroupAdminDetailScreenProps) {
  const { theme } = useTheme();
  const { t } = useTranslation("groupAdmin");
  const group = groups.find((g) => g.group_id === groupId);
  const [tab, setTab] = useState<GroupAdminTab>("overview");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [disputes, setDisputes] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [trustScore, setTrustScore] = useState<{ avg_score: number | null; rating_count: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [marketList, disputeList] = await Promise.all([
      marketService.getGroupMarkets(groupId),
      resolutionService.getGroupDisputes(groupId, "pending"),
    ]);
    setMarkets(marketList);
    setDisputes(disputeList);
    if (group?.group_id) {
      const members = await groupService.getGroupMembers(groupId);
      const admin = members.find((m) => m.role === "admin");
      if (admin?.user_id) {
        const score = await settlementGovernanceService.getAdminTrustScore(groupId, admin.user_id);
        setTrustScore(score);
      }
    }
    setLoading(false);
  }, [group?.group_id, groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const renderOverview = () => (
    <View style={styles.section}>
      <AppCard>
        <AppText variant="label">{t("trustScore")}</AppText>
        <AppText variant="title2">
          {trustScore?.avg_score != null ? trustScore.avg_score.toFixed(1) : "—"}
        </AppText>
        <AppText variant="caption" color="secondary">
          {trustScore?.rating_count ?? 0} ratings
        </AppText>
      </AppCard>
      <AppCard>
        <AppText variant="bodySm">{t("openPredictions")}: {group?.active_market_count ?? 0}</AppText>
        <AppText variant="bodySm">{t("pendingDisputes")}: {group?.pending_dispute_count ?? 0}</AppText>
        <AppText variant="bodySm">{t("memberCount")}: {group?.member_count ?? 0}</AppText>
      </AppCard>
      {group?.platform_override_active ? (
        <AppCard style={{ borderColor: theme.warning }}>
          <AppText variant="bodySm">{t("platformOverrideBanner")}</AppText>
        </AppCard>
      ) : null}
    </View>
  );

  const renderPredictions = () => (
    <View style={styles.section}>
      {markets.map((market) => (
        <AppCard key={market.id}>
          <AppText variant="bodySm">{market.question}</AppText>
          <AppText variant="caption" color="secondary">
            {market.status}
          </AppText>
          {market.status === "open" ? (
            <AppText
              variant="bodySm"
              color="primary"
              onPress={() => {
                Alert.alert(t("closeMarket"), "Stop new bets on this prediction?", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: t("closeMarket"),
                    onPress: () => void marketService.closeMarket(market.id).then(() => load()),
                  },
                ]);
              }}
            >
              {t("closeMarket")}
            </AppText>
          ) : null}
        </AppCard>
      ))}
    </View>
  );

  const renderDisputes = () => (
    <View style={styles.section}>
      {disputes.length === 0 ? (
        <AppText variant="bodySm" color="secondary">
          No pending disputes
        </AppText>
      ) : (
        disputes.map((d: any) => (
          <AppCard key={d.id}>
            <AppText variant="bodySm">{d.reason}</AppText>
            <AppText variant="caption" color="secondary">
              {d.status}
            </AppText>
          </AppCard>
        ))
      )}
    </View>
  );

  const renderSettings = () => (
    <View style={styles.section}>
      <View style={styles.toggleRow}>
        <AppText variant="bodySm">Discoverable</AppText>
        <Switch
          value={group?.is_discoverable ?? false}
          onValueChange={(v) => void groupService.updateGroupVisibility(groupId, { is_discoverable: v }).then(load)}
          trackColor={{ false: theme.border, true: theme.primary }}
        />
      </View>
      <View style={styles.toggleRow}>
        <AppText variant="bodySm">Show on profile</AppText>
        <Switch
          value={group?.show_on_profile ?? false}
          onValueChange={(v) => void groupService.updateGroupVisibility(groupId, { show_on_profile: v }).then(load)}
          trackColor={{ false: theme.border, true: theme.primary }}
        />
      </View>
    </View>
  );

  const body = loading ? (
    <ActivityIndicator color={theme.primary} />
  ) : (
    <>
      {tab === "overview" && renderOverview()}
      {tab === "predictions" && renderPredictions()}
      {tab === "disputes" && renderDisputes()}
      {tab === "members" && (
        <AppText variant="bodySm" color="secondary">
          Member management available from group chat.
        </AppText>
      )}
      {tab === "settings" && renderSettings()}
    </>
  );

  return (
    <GroupAdminShell
      groupName={group?.name ?? undefined}
      activeTab={tab}
      onTabChange={setTab}
      disputeBadge={disputes.length}
      predictionBadge={markets.filter((m) => m.status === "open" || m.status === "closed").length}
    >
      {body}
    </GroupAdminShell>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
  },
});
