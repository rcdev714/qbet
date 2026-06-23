import {
    AdminChartPanel,
    buildSparseDayLabels,
    ChartRange,
    formatAdminCompact,
    formatAdminCurrency,
} from "@/components/admin/AdminChartPanel";
import { AdminShell, useAdminLayoutMetrics } from "@/components/admin/AdminShell";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
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
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />
          }
        >
          {loading && !refreshing ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
          ) : (
            <>
              <View style={styles.heroRow}>
                <Text style={[styles.heroTitle, { color: theme.text }]}>{t("commandCenter")}</Text>
                <Text style={[styles.heroSub, { color: theme.textSecondary }]}>{t("commandCenterSub")}</Text>
              </View>

              {loadError ? (
                <View style={[styles.errorBanner, { backgroundColor: theme.error + "20", borderColor: theme.error }]}>
                  <Text style={[styles.errorBannerText, { color: theme.error }]}>{loadError}</Text>
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
                <Text style={[styles.sectionTitle, { color: theme.text }]}>{t("engagementMetrics")}</Text>
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
                        <Text style={{ color: theme.text, fontSize: 11, fontWeight: "700" }}>
                          {items[0]?.value} {t("usersLabel")}
                        </Text>
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
                  <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>
                    {t("fraudMonitor")}
                  </Text>
                  <View style={[styles.liveDot, { backgroundColor: fraudAlerts.length ? theme.error : theme.success }]} />
                </View>

                {fraudAlerts.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="checkmark-circle" size={40} color="#34C759" />
                    <Text style={{ color: theme.textSecondary, marginTop: 8 }}>{t("noFraudAlerts")}</Text>
                  </View>
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
                        <Text style={[styles.alertUser, { color: theme.text }]}>{alert.username}</Text>
                        <Text style={[styles.alertReason, { color: theme.error }]}>{alert.reason}</Text>
                        <Text style={[styles.alertDetails, { color: theme.textSecondary }]}>{alert.details}</Text>
                      </View>
                      <View
                        style={[
                          styles.severityBadge,
                          { backgroundColor: alert.severity === "high" ? "#FF3B30" : "#FF9500" },
                        ]}
                      >
                        <Text style={styles.severityText}>{alert.severity.toUpperCase()}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>

              <View style={{ height: 40 }} />
            </>
          )}
        </ScrollView>
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
        <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>{title}</Text>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={[styles.cardValue, { color: theme.text }]}>{value}</Text>
      {hint ? <Text style={[styles.cardHint, { color: theme.textSecondary }]}>{hint}</Text> : null}
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
        <Text style={[styles.linkTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.linkSub, { color: theme.textSecondary }]}>{subtitle}</Text>
      </View>
      {badge != null && badge > 0 ? (
        <View style={[styles.linkBadge, { backgroundColor: theme.error }]}>
          <Text style={styles.linkBadgeText}>{badge}</Text>
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
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

function LegendRow({ items }: { items: Array<{ color: string; label: string }> }) {
  return (
    <View style={styles.legendRow}>
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <Text style={styles.legendText}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  heroRow: { marginBottom: 16 },
  heroTitle: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  heroSub: { fontSize: 13, marginTop: 4 },
  errorBanner: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorBannerText: { fontSize: 13, lineHeight: 18 },
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
  cardTitle: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  cardValue: { fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"] },
  cardHint: { fontSize: 11, marginTop: 6 },
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
  linkTitle: { fontSize: 14, fontWeight: "700" },
  linkSub: { fontSize: 12, marginTop: 2 },
  linkBadge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  linkBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  section: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 16 },
  statsRow: { flexDirection: "row", justifyContent: "space-around" },
  statItem: { alignItems: "center", flex: 1 },
  statValue: { fontSize: 20, fontWeight: "700" },
  statLabel: { fontSize: 11, marginTop: 4, textAlign: "center" },
  emptyState: { alignItems: "center", padding: 24 },
  alertRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 },
  alertUser: { fontWeight: "700", fontSize: 15 },
  alertReason: { fontSize: 13, marginTop: 2, fontWeight: "600" },
  alertDetails: { fontSize: 12, marginTop: 2 },
  severityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginLeft: 8 },
  severityText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: "#888" },
  tooltip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
