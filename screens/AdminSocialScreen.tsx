import {
    AdminChartPanel,
    buildSparseDayLabels,
    ChartRange,
    formatAdminCompact,
} from "@/components/admin/AdminChartPanel";
import { AdminShell, useAdminLayoutMetrics } from "@/components/admin/AdminShell";
import { AppScreen } from "@/components/ui/AppScreen";
import { AppSkeleton } from "@/components/ui/AppSkeleton";
import { AppText } from "@/components/ui/AppText";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useTheme } from "@/contexts/ThemeContext";
import {
    AdminCoBetCluster,
    adminService,
    AdminSocialConnector,
    AdminSocialKPIs,
} from "@/services/admin.service";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    FlatList,
    RefreshControl,
    StatusBar,
    StyleSheet,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { LineChart } from "react-native-gifted-charts";

function StatCard({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <AppText variant="caption" color="secondary">
        {label}
      </AppText>
      <AppText variant="title3">{value}</AppText>
    </View>
  );
}

export default function AdminSocialScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { t } = useTranslation("admin");
  const { contentWidth } = useAdminLayoutMetrics();
  const { width: windowWidth } = useWindowDimensions();
  const chartWidth = Math.max(260, Math.min(contentWidth - 48, windowWidth - 64));

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartRange, setChartRange] = useState<ChartRange>(14);
  const [kpis, setKpis] = useState<AdminSocialKPIs | null>(null);
  const [connectors, setConnectors] = useState<AdminSocialConnector[]>([]);
  const [clusters, setClusters] = useState<AdminCoBetCluster[]>([]);
  const [followDates, setFollowDates] = useState<string[]>([]);
  const [followCounts, setFollowCounts] = useState<number[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoadError(null);
      const [kpiData, connectorData, clusterData, series] = await Promise.all([
        adminService.getSocialKPIs(),
        adminService.listSocialConnectors(20),
        adminService.listCoBetClusters(20),
        adminService.getFollowSeries(chartRange),
      ]);
      setKpis(kpiData);
      setConnectors(connectorData);
      setClusters(clusterData);
      setFollowDates(series.dates);
      setFollowCounts(series.counts);
    } catch {
      setLoadError(t("loadDashboardFailed"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [chartRange, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const chartLabels = useMemo(() => buildSparseDayLabels(followDates), [followDates]);

  const chartData = useMemo(
    () =>
      followCounts.map((value, index) => ({
        value,
        label: chartLabels[index] ?? "",
      })),
    [followCounts, chartLabels],
  );

  const renderConnector = ({ item }: { item: AdminSocialConnector }) => (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <View style={styles.rowMain}>
        <AppText variant="body">@{item.username ?? "unknown"}</AppText>
        <AppText variant="caption" color="secondary">
          {t("socialConnectorMeta", {
            followers: item.followersCount,
            bets: item.totalBets,
            volume: formatAdminCompact(item.betVolume),
          })}
        </AppText>
      </View>
      <AppText variant="caption" color="secondary">
        {Math.round(item.winRate * 100)}%
      </AppText>
    </View>
  );

  const renderCluster = ({ item }: { item: AdminCoBetCluster }) => (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <View style={styles.rowMain}>
        <AppText variant="body" numberOfLines={2}>
          {item.label}
        </AppText>
        <AppText variant="caption" color="secondary">
          {t("socialClusterMeta", {
            users: item.userCount,
            bets: item.betCount,
            volume: formatAdminCompact(item.totalVolume),
            side: item.dominantSide?.toUpperCase() ?? "—",
          })}
        </AppText>
      </View>
      <AppText variant="caption" color="secondary">
        {item.clusterType}
      </AppText>
    </View>
  );

  return (
    <AdminShell title={t("socialGraphTitle")}>
      <AppScreen style={{ backgroundColor: theme.background }}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <FlatList
          data={[{ key: "content" }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadData(); }} />}
          renderItem={() => (
            <View style={styles.content}>
              <TouchableOpacity onPress={() => router.back()}>
                <AppText variant="bodySm" color="primary">
                  ← {t("backToDashboard")}
                </AppText>
              </TouchableOpacity>

              {loadError ? <ErrorBanner message={loadError} onRetry={() => loadData()} retryLabel={t("retry")} /> : null}

              {loading ? (
                <AppSkeleton height={120} />
              ) : (
                <>
                  <View style={styles.statsGrid}>
                    <StatCard label={t("socialTotalFollows")} value={String(kpis?.totalFollows ?? 0)} theme={theme} />
                    <StatCard label={t("socialFollows7d")} value={String(kpis?.follows7d ?? 0)} theme={theme} />
                    <StatCard label={t("socialActiveBettors7d")} value={String(kpis?.activeSocialBettors7d ?? 0)} theme={theme} />
                    <StatCard label={t("socialActiveGroups")} value={String(kpis?.activeGroups ?? 0)} theme={theme} />
                  </View>

                  <AdminChartPanel
                    title={t("socialFollowChart")}
                    subtitle={t("socialFollowChartSub", { days: chartRange })}
                    range={chartRange}
                    onRangeChange={setChartRange}
                    empty={chartData.length === 0}
                  >
                    <LineChart
                      data={chartData}
                      width={chartWidth}
                      height={180}
                      color={theme.primary}
                      thickness={2}
                      hideDataPoints
                      yAxisTextStyle={{ color: theme.textSecondary, fontSize: 10 }}
                      xAxisLabelTextStyle={{ color: theme.textSecondary, fontSize: 10 }}
                    />
                  </AdminChartPanel>

                  <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <AppText variant="title3" style={styles.sectionTitle}>
                      {t("socialTopConnectors")}
                    </AppText>
                    <FlatList
                      data={connectors}
                      keyExtractor={(item) => item.userId}
                      renderItem={renderConnector}
                      scrollEnabled={false}
                    />
                  </View>

                  <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <AppText variant="title3" style={styles.sectionTitle}>
                      {t("socialCoBetClusters")}
                    </AppText>
                    <AppText variant="caption" color="secondary" style={styles.riskNote}>
                      {t("socialClusterRiskNote")}
                    </AppText>
                    <FlatList
                      data={clusters}
                      keyExtractor={(item) => `${item.clusterType}-${item.clusterKey}`}
                      renderItem={renderCluster}
                      scrollEnabled={false}
                    />
                  </View>
                </>
              )}
            </View>
          )}
        />
      </AppScreen>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flexGrow: 1,
    minWidth: "45%",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: { marginBottom: 12 },
  riskNote: { marginBottom: 12, lineHeight: 18 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowMain: { flex: 1, gap: 4 },
});
