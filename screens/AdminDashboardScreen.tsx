import { AdminShell, useAdminLayoutMetrics } from "@/components/admin/AdminShell";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
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
import { adminService, FraudAlert, GrowthMetric, KPISummary } from "../services/admin.service";
import { moderationService, type ContentReport } from "../services/moderation.service";

export default function AdminDashboardScreen() {
  const { theme, isDark } = useTheme();
  const { contentWidth } = useAdminLayoutMetrics();
  const { width: windowWidth } = useWindowDimensions();
  const chartWidth = Math.max(260, Math.min(contentWidth - 32, windowWidth - 48));

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kpi, setKpi] = useState<KPISummary | null>(null);
  const [userGrowth, setUserGrowth] = useState<GrowthMetric[]>([]);
  const [volumeData, setVolumeData] = useState<GrowthMetric[]>([]);
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [contentReports, setContentReports] = useState<ContentReport[]>([]);

  const loadData = async () => {
    try {
      const [kpiData, growthData, betVolume, alerts, reports] = await Promise.all([
        adminService.getKPISummary(),
        adminService.getUserGrowth(14), // Last 14 days
        adminService.getBettingVolume(14),
        adminService.getFraudAlerts(),
        moderationService.listContentReports("open"),
      ]);

      setKpi(kpiData);
      setUserGrowth(growthData);
      setVolumeData(betVolume);
      setFraudAlerts(alerts);
      setContentReports(reports);
    } catch (e) {
      console.error("Failed to load admin data", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const chartData_Users = userGrowth.map(item => ({
    value: item.count,
    label: item.date.split("-")[2], // Just the day
    dataPointText: String(item.count)
  }));

  const chartData_Volume = volumeData.map(item => ({
    value: item.count,
    label: item.date.split("-")[2],
    dataPointText: String(Math.round(item.count))
  }));

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
            {/* KPI Cards Row 1 */}
            <View style={styles.row}>
              <KPICard 
                title="Total Users" 
                value={kpi?.totalUsers ?? 0} 
                icon="people" 
                theme={theme} 
              />
              <KPICard 
                title="Total Bets" 
                value={kpi?.totalBets ?? 0} 
                icon="game-controller" 
                theme={theme} 
              />
            </View>

            {/* KPI Cards Row 2 */}
            <View style={styles.row}>
              <KPICard 
                title="Total Volume" 
                value={`$${(kpi?.totalVolume ?? 0).toLocaleString()}`} 
                icon="cash" 
                theme={theme} 
                color="#34C759"
              />
               <KPICard 
                title="Active Mkts" 
                value={kpi?.activeMarkets ?? 0} 
                icon="flash" 
                theme={theme} 
                color="#FF9500"
              />
            </View>

             {/* Engagement Metrics */}
             <View style={[styles.section, { backgroundColor: theme.surface }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Engagement Metrics</Text>
                <View style={styles.statsRow}>
                    <StatItem label="Bets / User" value={kpi?.betsPerUser.toFixed(2) ?? "0.00"} theme={theme} />
                    <StatItem label="Predictions / User" value={kpi?.predictionsPerUser.toFixed(2) ?? "0.00"} theme={theme} />
                </View>
             </View>

            {/* User Growth Chart */}
            <View style={[styles.section, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>User Growth (Cumulative)</Text>
              {chartData_Users.length > 0 ? (
                 <LineChart
                    data={chartData_Users}
                    color={theme.primary}
                    thickness={3}
                    dataPointsColor={theme.primary}
                    textColor={theme.textSecondary}
                    xAxisColor={theme.border}
                    yAxisColor={theme.border}
                    yAxisTextStyle={{ color: theme.textSecondary, fontSize: 10 }}
                    xAxisLabelTextStyle={{ color: theme.textSecondary, fontSize: 10 }}
                    width={chartWidth}
                    hideRules
                    initialSpacing={20}
                 />
              ) : (
                <Text style={{ color: theme.textSecondary, textAlign: "center", marginVertical: 20 }}>No data available</Text>
              )}
            </View>

            {/* Betting Volume Chart */}
            <View style={[styles.section, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Daily Betting Volume ($)</Text>
              {chartData_Volume.length > 0 ? (
                 <LineChart
                    data={chartData_Volume}
                    color="#34C759"
                    thickness={3}
                    dataPointsColor="#34C759"
                    textColor={theme.textSecondary}
                    xAxisColor={theme.border}
                    yAxisColor={theme.border}
                    yAxisTextStyle={{ color: theme.textSecondary, fontSize: 10 }}
                    xAxisLabelTextStyle={{ color: theme.textSecondary, fontSize: 10 }}
                    width={chartWidth}
                    hideRules
                    initialSpacing={20}
                    curved
                 />
              ) : (
                <Text style={{ color: theme.textSecondary, textAlign: "center", marginVertical: 20 }}>No data available</Text>
              )}
            </View>

            {/* Fraud / Risk Monitor */}
            <View style={[styles.section, { backgroundColor: theme.surface }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Fraud Monitor 🚨</Text>
              </View>
              
              {fraudAlerts.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="checkmark-circle" size={40} color="#34C759" />
                    <Text style={{ color: theme.textSecondary, marginTop: 8 }}>No suspicious activity detected.</Text>
                </View>
              ) : (
                fraudAlerts.map((alert, index) => (
                    <View key={index} style={[styles.alertRow, { borderBottomColor: theme.border, borderBottomWidth: index === fraudAlerts.length - 1 ? 0 : 1 }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.alertUser, { color: theme.text }]}>{alert.username}</Text>
                            <Text style={[styles.alertReason, { color: theme.error }]}>{alert.reason}</Text>
                            <Text style={[styles.alertDetails, { color: theme.textSecondary }]}>{alert.details}</Text>
                        </View>
                        <View style={[styles.severityBadge, { backgroundColor: alert.severity === 'high' ? '#FF3B30' : '#FF9500' }]}>
                            <Text style={styles.severityText}>{alert.severity.toUpperCase()}</Text>
                        </View>
                    </View>
                ))
              )}
            </View>

            <View style={[styles.section, { backgroundColor: theme.surface }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Content reports</Text>
              </View>
              {contentReports.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={{ color: theme.textSecondary }}>No open reports.</Text>
                </View>
              ) : (
                contentReports.map((report) => (
                  <View key={report.id} style={[styles.alertRow, { borderBottomColor: theme.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.alertUser, { color: theme.text }]}>{report.target_type}</Text>
                      <Text style={[styles.alertReason, { color: theme.error }]}>{report.reason}</Text>
                      <Text style={[styles.alertDetails, { color: theme.textSecondary }]}>
                        Target {report.target_id.slice(0, 12)}… · {new Date(report.created_at).toLocaleString()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={async () => {
                        await moderationService.resolveContentReport({
                          reportId: report.id,
                          status: "resolved",
                          adminNotes: "Reviewed from admin dashboard",
                          restrictUser: false,
                        });
                        loadData();
                      }}
                      style={[styles.resolveButton, { borderColor: theme.border }]}
                    >
                      <Text style={{ color: theme.primary, fontSize: 12, fontWeight: "600" }}>Resolve</Text>
                    </TouchableOpacity>
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

function KPICard({ title, value, icon, theme, color }: any) {
    const iconColor = color || theme.primary;
    return (
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>{title}</Text>
                <Ionicons name={icon} size={20} color={iconColor} />
            </View>
            <Text style={[styles.cardValue, { color: theme.text }]}>{value}</Text>
        </View>
    );
}

function StatItem({ label, value, theme }: any) {
    return (
        <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  card: {
    flex: 1,
    minWidth: 140,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  cardValue: {
    fontSize: 24,
    fontWeight: "600",
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  emptyState: {
    alignItems: "center",
    padding: 24,
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  resolveButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  alertUser: {
    fontWeight: "600",
    fontSize: 15,
  },
  alertReason: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: "600",
  },
  alertDetails: {
    fontSize: 12,
    marginTop: 2,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  severityText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  }
});
