import {
    AdminChartPanel,
    buildSparseDayLabels,
    ChartRange,
    formatAdminCompact,
    formatAdminCurrency,
} from "@/components/admin/AdminChartPanel";
import { AdminShell, useAdminLayoutMetrics } from "@/components/admin/AdminShell";
import { AppScreen } from "@/components/ui/AppScreen";
import { AppSkeleton } from "@/components/ui/AppSkeleton";
import { AppText } from "@/components/ui/AppText";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Platform,
    RefreshControl,
    StatusBar,
    StyleSheet,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { useTheme } from "../contexts/ThemeContext";
import {
    adminService,
    DailyFinancialSeries,
    FinancialKPIs,
    FraudAlert,
    GrowthMetric,
    KPISummary,
} from "../services/admin.service";

export default function AdminDashboardScreen() {
  const { theme, isDark } = useTheme();
  const { contentWidth } = useAdminLayoutMetrics();
  const { width: windowWidth } = useWindowDimensions();
  const router = useRouter();
  const { t } = useTranslation("admin");
  const chartWidth = Math.max(260, Math.min(contentWidth - 48, windowWidth - 64));

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartRange, setChartRange] = useState<ChartRange>(14);
  const [kpi, setKpi] = useState<KPISummary | null>(null);
  const [financial, setFinancial] = useState<FinancialKPIs | null>(null);
  const [userGrowth, setUserGrowth] = useState<GrowthMetric[]>([]);
  const [volumeData, setVolumeData] = useState<GrowthMetric[]>([]);
  const [financialSeries, setFinancialSeries] = useState<DailyFinancialSeries>({
    dates: [],
    deposits: [],
    withdrawals: [],
    betVolume: [],
  });
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoadError(null);
      const [kpiData, financialData, growthData, betVolume, series, alerts] = await Promise.all([
        adminService.getKPISummary(),
        adminService.getFinancialKPIs(),
        adminService.getUserGrowth(chartRange),
        adminService.getBettingVolume(chartRange),
        adminService.getDailyFinancialSeries(chartRange),
        adminService.getFraudAlerts(),
      ]);

      setKpi(kpiData);
      setFinancial(financialData);
      setUserGrowth(growthData);
      setVolumeData(betVolume);
      setFinancialSeries(series);
      setFraudAlerts(alerts);
    } catch (e) {
      console.error("Failed to load admin data", e);
      setLoadError(t("loadDashboardFailed"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [chartRange, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadData();
  };

  const dayLabels = useMemo(
    () => buildSparseDayLabels(financialSeries.dates),
    [financialSeries.dates],
  );

  const chartDataUsers = userGrowth.map((item, index) => ({
    value: item.count,
    label: index === userGrowth.length - 1 || index % Math.ceil(userGrowth.length / 6) === 0
      ? item.date.split("-").slice(1).join("/")
      : "",
    dataPointText: String(item.count),
  }));

  const chartDataVolume = volumeData.map((item, index) => ({
    value: item.count,
    label: index === volumeData.length - 1 || index % Math.ceil(volumeData.length / 6) === 0
      ? item.date.split("-").slice(1).join("/")
      : "",
    dataPointText: String(Math.round(item.count)),
  }));

  const depositSeries = financialSeries.deposits.map((value, index) => ({
    value,
    label: dayLabels[index] ?? "",
  }));

  const withdrawalSeries = financialSeries.withdrawals.map((value, index) => ({
    value,
    label: dayLabels[index] ?? "",
  }));

  const periodDeposits = financialSeries.deposits.reduce((s, v) => s + v, 0);
  const periodWithdrawals = financialSeries.withdrawals.reduce((s, v) => s + v, 0);
  const periodBetVolume = financialSeries.betVolume.reduce((s, v) => s + v, 0);
  const netDeposits = (financial?.totalDeposits ?? 0) - (financial?.totalWithdrawals ?? 0);

  return (
    <>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <AdminShell>
        <AppScreen
          maxWidth="wide"
          scroll
          style={styles.adminScreen}
          scrollProps={{
            showsVerticalScrollIndicator: false,
            refreshControl: (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />
            ),
            contentContainerStyle: styles.scrollContent,
          }}
        >
          {loading && !refreshing ? (
            <View style={styles.skeletonStack}>
              <AppSkeleton variant="text" width="55%" height={24} />
              <AppSkeleton variant="text" width="75%" />
              <View style={styles.row}>
                <AppSkeleton variant="card" style={{ flex: 1, minWidth: 140 }} />
                <AppSkeleton variant="card" style={{ flex: 1, minWidth: 140 }} />
              </View>
              <View style={styles.row}>
                <AppSkeleton variant="card" style={{ flex: 1, minWidth: 140 }} />
                <AppSkeleton variant="card" style={{ flex: 1, minWidth: 140 }} />
              </View>
              <AppSkeleton variant="card" height={200} />
            </View>
          ) : (
            <>
              <View style={styles.heroRow}>
                <AppText variant="title2">{t("commandCenter")}</AppText>
                <AppText variant="bodySm" color="secondary" style={{ marginTop: 4 }}>
                  {t("commandCenterSub")}
                </AppText>
              </View>

              {loadError ? (
                <View style={{ marginBottom: 16 }}>
                  <ErrorBanner
                    message={loadError}
                    onRetry={() => void loadData()}
                    retryLabel={t("retry", { ns: "common", defaultValue: "Retry" })}
                  />
                </View>
              ) : null}

              <View style={styles.row}>
                <KPICard title={t("totalUsers")} value={kpi?.totalUsers ?? 0} icon="people" theme={theme} />
                <KPICard title={t("totalBets")} value={kpi?.totalBets ?? 0} icon="game-controller" theme={theme} />
              </View>

              <View style={styles.row}>
                <KPICard
                  title={t("betVolume")}
                  value={formatAdminCurrency(kpi?.totalVolume ?? 0)}
                  icon="cash"
                  theme={theme}
                  color="#34C759"
                  hint={t("liveStakesOnly")}
                />
                <KPICard
                  title={t("stripeDeposits")}
                  value={formatAdminCurrency(financial?.totalDeposits ?? 0)}
                  icon="card"
                  theme={theme}
                  color="#007AFF"
                />
              </View>

              <View style={styles.row}>
                <KPICard
                  title={t("walletFloat")}
                  value={formatAdminCurrency(financial?.walletFloat ?? 0)}
                  icon="wallet"
                  theme={theme}
                  color="#5856D6"
                />
                <KPICard
                  title={t("netDeposits")}
                  value={formatAdminCurrency(netDeposits)}
                  icon="swap-horizontal"
                  theme={theme}
                  color={netDeposits >= 0 ? "#34C759" : theme.error}
                  hint={t("depositsMinusWithdrawals")}
                />
              </View>

              <View style={styles.row}>
                <QuickLinkCard
                  title={t("transactions")}
                  subtitle={t("transactionsLinkSub")}
                  icon="receipt-outline"
                  theme={theme}
                  onPress={() => router.push("/admin/transactions" as any)}
                />
                <QuickLinkCard
                  title={t("reports")}
                  subtitle={t("reportsLinkSub", { count: financial?.openReports ?? 0 })}
                  icon="flag-outline"
                  theme={theme}
                  onPress={() => router.push("/admin/reports" as any)}
                  badge={financial?.openReports}
                />
              </View>

              <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <AppText variant="title3" style={{ marginBottom: 16 }}>{t("engagementMetrics")}</AppText>
                <View style={styles.statsRow}>
                  <StatItem label={t("betsPerUser")} value={kpi?.betsPerUser.toFixed(2) ?? "0.00"} theme={theme} />
                  <StatItem
                    label={t("activeMarkets")}
                    value={String(kpi?.activeMarkets ?? 0)}
                    theme={theme}
                  />
                  <StatItem
                    label={t("periodBetVolume", { days: chartRange })}
                    value={formatAdminCompact(periodBetVolume)}
                    theme={theme}
                  />
                </View>
              </View>

              <AdminChartPanel
                title={t("userGrowthChart")}
                subtitle={t("cumulativeUsers")}
                range={chartRange}
                onRangeChange={setChartRange}
                empty={chartDataUsers.length === 0}
                footer={
                  <LegendRow
                    items={[{ color: theme.primary, label: t("totalUsers") }]}
                  />
                }
              >
                <LineChart
                  data={chartDataUsers}
                  areaChart
                  startFillColor={`${theme.primary}44`}
                  endFillColor={`${theme.primary}05`}
                  startOpacity={0.35}
                  endOpacity={0.05}
                  color={theme.primary}
                  thickness={2.5}
                  dataPointsColor={theme.primary}
                  dataPointsRadius={3}
                  textColor={theme.textSecondary}
                  xAxisColor={theme.border}
                  yAxisColor={theme.border}
                  rulesColor={`${theme.border}88`}
                  rulesType="solid"
                  yAxisTextStyle={{ color: theme.textSecondary, fontSize: 10 }}
                  xAxisLabelTextStyle={{ color: theme.textSecondary, fontSize: 9 }}
                  width={chartWidth}
                  height={210}
                  initialSpacing={12}
                  endSpacing={12}
                  curved
                  hideDataPoints={chartDataUsers.length > 20}
                  pointerConfig={{
                    pointerStripColor: theme.border,
                    pointerColor: theme.primary,
                    radius: 4,
                    pointerLabelComponent: (items: any[]) => (
                      <View style={[styles.tooltip, { backgroundColor: theme.background, borderColor: theme.border }]}>
                        <AppText variant="caption" style={{ fontWeight: "700" }}>
                          {items[0]?.value} {t("usersLabel")}
                        </AppText>
                      </View>
                    ),
                  }}
                />
              </AdminChartPanel>

              <AdminChartPanel
                title={t("cashFlowChart")}
                subtitle={t("cashFlowChartSub", { days: chartRange })}
                range={chartRange}
                onRangeChange={setChartRange}
                empty={depositSeries.length === 0}
                footer={
                  <LegendRow
                    items={[
                      { color: theme.success, label: `${t("deposits")} ${formatAdminCompact(periodDeposits)}` },
                      { color: theme.error, label: `${t("withdrawals")} ${formatAdminCompact(periodWithdrawals)}` },
                    ]}
                  />
                }
              >
                <LineChart
                  data={depositSeries}
                  data2={withdrawalSeries}
                  color={theme.success}
                  color2={theme.error}
                  thickness={2.5}
                  thickness2={2.5}
                  dataPointsColor={theme.success}
                  dataPointsColor2={theme.error}
                  textColor={theme.textSecondary}
                  xAxisColor={theme.border}
                  yAxisColor={theme.border}
                  rulesColor={`${theme.border}88`}
                  yAxisTextStyle={{ color: theme.textSecondary, fontSize: 10 }}
                  xAxisLabelTextStyle={{ color: theme.textSecondary, fontSize: 9 }}
                  width={chartWidth}
                  height={210}
                  initialSpacing={12}
                  endSpacing={12}
                  curved
                  hideDataPoints={depositSeries.length > 20}
                  formatYLabel={(v) => formatAdminCompact(Number(v))}
                />
              </AdminChartPanel>

              <AdminChartPanel
                title={t("betVolumeChart")}
                subtitle={t("dailyLiveStakes")}
                range={chartRange}
                onRangeChange={setChartRange}
                empty={chartDataVolume.every((d) => d.value === 0)}
                footer={
                  <LegendRow items={[{ color: "#34C759", label: t("liveBetVolume") }]} />
                }
              >
                <LineChart
                  data={chartDataVolume}
                  areaChart
                  startFillColor="#34C75933"
                  endFillColor="#34C75905"
                  color="#34C759"
                  thickness={2.5}
                  dataPointsColor="#34C759"
                  textColor={theme.textSecondary}
                  xAxisColor={theme.border}
                  yAxisColor={theme.border}
                  rulesColor={`${theme.border}88`}
                  yAxisTextStyle={{ color: theme.textSecondary, fontSize: 10 }}
                  xAxisLabelTextStyle={{ color: theme.textSecondary, fontSize: 9 }}
                  width={chartWidth}
                  height={200}
                  initialSpacing={12}
                  endSpacing={12}
                  curved
                  hideDataPoints={chartDataVolume.length > 20}
                  formatYLabel={(v) => formatAdminCompact(Number(v))}
                />
              </AdminChartPanel>

              <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.sectionHeader}>
                  <AppText variant="title3" style={{ marginBottom: 0 }}>
                    {t("fraudMonitor")}
                  </AppText>
                  <View style={[styles.liveDot, { backgroundColor: fraudAlerts.length ? theme.error : theme.success }]} />
                </View>

                {fraudAlerts.length === 0 ? (
                  <EmptyState icon="checkmark-circle" title={t("noFraudAlerts")} />
                ) : (
                  fraudAlerts.map((alert, index) => (
                    <View
                      key={`${alert.userId}-${index}`}
                      style={[
                        styles.alertRow,
                        {
                          borderBottomColor: theme.border,
                          borderBottomWidth: index === fraudAlerts.length - 1 ? 0 : StyleSheet.hairlineWidth,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <AppText variant="body" style={{ fontWeight: "700" }}>{alert.username}</AppText>
                        <AppText variant="bodySm" color="destructive" style={{ marginTop: 2, fontWeight: "600" }}>
                          {alert.reason}
                        </AppText>
                        <AppText variant="bodySm" color="secondary" style={{ marginTop: 2 }}>
                          {alert.details}
                        </AppText>
                      </View>
                      <View
                        style={[
                          styles.severityBadge,
                          { backgroundColor: alert.severity === "high" ? "#FF3B30" : "#FF9500" },
                        ]}
                      >
                        <AppText variant="caption" color="onPrimary" style={{ fontWeight: "800" }}>
                          {alert.severity.toUpperCase()}
                        </AppText>
                      </View>
                    </View>
                  ))
                )}
              </View>

              <View style={{ height: 40 }} />
            </>
          )}
        </AppScreen>
      </AdminShell>
    </>
  );
}

function KPICard({
  title,
  value,
  icon,
  theme,
  color,
  hint,
}: {
  title: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  theme: ReturnType<typeof useTheme>["theme"];
  color?: string;
  hint?: string;
}) {
  const iconColor = color || theme.primary;
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.cardHeader}>
        <AppText variant="caption" color="secondary" style={{ fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 }}>
          {title}
        </AppText>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <AppText variant="title2" style={{ fontVariant: ["tabular-nums"] }}>{value}</AppText>
      {hint ? (
        <AppText variant="caption" color="secondary" style={{ marginTop: 6 }}>{hint}</AppText>
      ) : null}
    </View>
  );
}

function QuickLinkCard({
  title,
  subtitle,
  icon,
  theme,
  onPress,
  badge,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  theme: ReturnType<typeof useTheme>["theme"];
  onPress: () => void;
  badge?: number;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.linkCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
      activeOpacity={0.85}
    >
      <View style={[styles.linkIconWrap, { backgroundColor: theme.primarySoft }]}>
        <Ionicons name={icon} size={20} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="bodySm" style={{ fontWeight: "700" }}>{title}</AppText>
        <AppText variant="caption" color="secondary" style={{ marginTop: 2 }}>{subtitle}</AppText>
      </View>
      {badge != null && badge > 0 ? (
        <View style={[styles.linkBadge, { backgroundColor: theme.error }]}>
          <AppText variant="caption" color="onPrimary" style={{ fontWeight: "800" }}>{badge}</AppText>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      )}
    </TouchableOpacity>
  );
}

function StatItem({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  return (
    <View style={styles.statItem}>
      <AppText variant="title2" style={{ fontWeight: "700" }}>{value}</AppText>
      <AppText variant="caption" color="secondary" style={{ marginTop: 4, textAlign: "center" }}>{label}</AppText>
    </View>
  );
}

function LegendRow({ items }: { items: Array<{ color: string; label: string }> }) {
  return (
    <View style={styles.legendRow}>
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <AppText variant="caption" color="secondary">{item.label}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  adminScreen: {
    flex: 1,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  skeletonStack: { gap: 12, marginTop: 8 },
  scrollContent: { paddingBottom: 32 },
  heroRow: { marginBottom: 16 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 12 },
  card: {
    flex: 1,
    minWidth: 140,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  linkCard: {
    flex: 1,
    minWidth: 160,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    ...(Platform.OS === "web" && ({ cursor: "pointer" } as any)),
  },
  linkIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  linkBadge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  section: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  statsRow: { flexDirection: "row", justifyContent: "space-around" },
  statItem: { alignItems: "center", flex: 1 },
  alertRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 },
  severityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginLeft: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  tooltip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
