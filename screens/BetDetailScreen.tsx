import { Brand } from "@/constants/theme";
import { AppScreen } from "@/components/ui/AppScreen";
import { AppSkeleton } from "@/components/ui/AppSkeleton";
import { AppText } from "@/components/ui/AppText";
import { EmptyState } from "@/components/ui/EmptyState";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Dimensions,
    Platform,
    StatusBar,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { PlayBetDetailView } from "../components/play-mode/PlayBetDetailView";
import { useTheme } from "../contexts/ThemeContext";
import { useWalletContext } from "../contexts/WalletContext";
import { useMarket } from "../hooks/useMarket";
import { formatCurrency } from "../lib/parimutuel";
import { getParamString } from "../lib/route-params";
import { supabase } from "../lib/supabase";
// Removed RootStackParamList import

interface BetWithUser {
  id: string;
  user_id: string;
  option_id: string;
  amount: number;
  placed_at: string;
  user: {
    username: string | null;
    email: string | null;
  } | null;
}

interface UserBetSummary {
  userId: string;
  username: string;
  optionId: string;
  optionLabel: string;
  totalAmount: number;
  color: string;
}

// Vibrant, non-repeating colors for options
const VIBRANT_COLORS = [
  "#00D1FF", // Neon Blue
  "#FFB800", // Bright Yellow
  "#FF2D55", // Pink/Red
  Brand.success,
  "#AF52DE", // Purple
  "#FF9500", // Orange
  "#5856D6", // Royal Blue
  Brand.primary,
];

const { width: windowWidth } = Dimensions.get('window');
const MAX_WEB_WIDTH = 600;
const CHART_WIDTH = Platform.OS === 'web' ? Math.min(windowWidth, MAX_WEB_WIDTH) - 60 : windowWidth - 60;
const SPACING_WIDTH = Platform.OS === 'web' ? Math.min(windowWidth, MAX_WEB_WIDTH) - 80 : windowWidth - 80;

export function BetDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const marketId = getParamString(params.id) ?? null;
  const { market, options, loading: marketLoading } = useMarket(marketId);
  const { theme, isDark } = useTheme();
  const { t } = useTranslation("market");
  const { isPlayMode } = useWalletContext();
  const [bets, setBets] = useState<BetWithUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Calculate probability history for the chart
  const chartData = React.useMemo(() => {
    if (bets.length === 0) return [];

    const chronologicalBets = [...bets].reverse();
    const runningPools = new Map<string, number>();
    options.forEach((opt) => runningPools.set(opt.id, 0));
    let runningTotal = 0;

    const historyByOption: Record<string, { value: number; label?: string }[]> = {};
    options.forEach((opt) => (historyByOption[opt.id] = []));

    chronologicalBets.forEach((bet) => {
      const currentAmount = runningPools.get(bet.option_id) || 0;
      runningPools.set(bet.option_id, currentAmount + bet.amount);
      runningTotal += bet.amount;

      options.forEach((opt) => {
        const optPool = runningPools.get(opt.id) || 0;
        const prob = (optPool / runningTotal) * 100;
        historyByOption[opt.id].push({ value: prob });
      });
    });

    return options.map((opt, index) => {
      const color = VIBRANT_COLORS[index % VIBRANT_COLORS.length];
      // Configure data points: hide all except the last one
      const dataWithPoints = historyByOption[opt.id].map((point, idx, arr) => ({
        ...point,
        hideDataPoint: idx !== arr.length - 1,
        dataPointColor: color,
        dataPointRadius: 4,
        dataPointStrokeColor: isDark ? "#000" : "#fff",
        dataPointStrokeWidth: 2,
      }));

      return {
        data: dataWithPoints,
        color: color,
        thickness: 1.5,
        hideDataPoints: false,
        curved: false,
      };
    });
  }, [bets, options, isDark]);

  useEffect(() => {
    if (!marketId) {
      setLoading(false);
      return;
    }
    const fetchBets = async () => {
      try {
        const { data, error } = await supabase
          .from("bets")
          .select(`
            id,
            user_id,
            option_id,
            amount,
            placed_at,
            user:users!bets_user_id_fkey (
              username,
              email
            )
          `)
          .eq("market_id", marketId)
          .order("placed_at", { ascending: false });

        if (!error && data) {
          setBets(data as unknown as BetWithUser[]);
        }
      } catch (err) {
        console.error("Error fetching bets:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBets();
  }, [marketId]);

  if (loading || marketLoading) {
    return (
      <>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <AppScreen maxWidth="narrow" style={{ gap: 16 }}>
          <AppSkeleton variant="text" width="50%" height={20} />
          <AppSkeleton variant="text" width="90%" height={28} />
          <AppSkeleton variant="card" height={180} />
          <AppSkeleton variant="row" />
          <AppSkeleton variant="row" />
        </AppScreen>
      </>
    );
  }

  if (!market) {
    return (
      <>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <AppScreen maxWidth="narrow">
          <View style={styles.centerContainer}>
            <AppText variant="body" color="destructive">{t("notFound")}</AppText>
          </View>
        </AppScreen>
      </>
    );
  }

  const resolvedMarketId = market.id;

  // Aggregate bets by user and option
  const userBetMap = new Map<string, UserBetSummary>();
  const userColorMap = new Map<string, string>();
  let colorIndex = 0;

  bets.forEach((bet) => {
    if (!userColorMap.has(bet.user_id)) {
      userColorMap.set(bet.user_id, VIBRANT_COLORS[colorIndex % VIBRANT_COLORS.length]);
      colorIndex++;
    }

    const key = `${bet.user_id}-${bet.option_id}`;
    const option = options.find((o) => o.id === bet.option_id);
    const existing = userBetMap.get(key);

    if (existing) {
      existing.totalAmount += bet.amount;
    } else {
      userBetMap.set(key, {
        userId: bet.user_id,
        username: bet.user?.username || bet.user?.email?.split("@")[0] || "Anonymous",
        optionId: bet.option_id,
        optionLabel: option?.label || "Unknown",
        totalAmount: bet.amount,
        color: userColorMap.get(bet.user_id) || VIBRANT_COLORS[0],
      });
    }
  });

  const userBets = Array.from(userBetMap.values());
  const totalPool = options.reduce((sum, opt) => sum + Number(opt.total_pool), 0);

  // Group by option for display
  const optionGroups = options.map((option, index) => {
    const optionBets = userBets.filter((b) => b.optionId === option.id);
    const optionTotal = Number(option.total_pool);
    return {
      option,
      bets: optionBets.sort((a, b) => b.totalAmount - a.totalAmount),
      total: optionTotal,
      percentage: totalPool > 0 ? (optionTotal / totalPool) * 100 : 0,
      color: VIBRANT_COLORS[index % VIBRANT_COLORS.length],
    };
  });


  return (
    <>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <AppScreen maxWidth="narrow" scroll scrollProps={{ contentContainerStyle: styles.scrollContent, showsVerticalScrollIndicator: false }}>
        <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <AppText style={{ fontSize: 24, color: isPlayMode ? theme.primary : theme.success }}>←</AppText>
          </TouchableOpacity>
          <AppText variant="title3">{t("betDistribution")}</AppText>
        </View>

        <View style={[styles.questionSection, { backgroundColor: theme.background }]}>
          <AppText variant="title2" style={{ letterSpacing: -0.5, lineHeight: 28, marginBottom: 12 }}>
            {market.question}
          </AppText>
          <View style={styles.metaRow}>
            <View style={[styles.statusBadge, market.status === "open" && { backgroundColor: isPlayMode ? '#E7F3FF' : '#E7FFE7' }]}>
              <AppText
                variant="caption"
                style={{
                  fontWeight: '400',
                  color: market.status === "open" ? (isPlayMode ? theme.primary : theme.success) : theme.textSecondary,
                }}
              >
                {(market.status || 'open').toUpperCase()}
              </AppText>
            </View>
            <AppText variant="bodySm" color="secondary">
              {t("totalPool", { amount: formatCurrency(totalPool) })}
            </AppText>
          </View>
        </View>

        {/* Distribution Chart */}
        {isPlayMode ? (
          <PlayBetDetailView
            marketId={resolvedMarketId}
            options={options.map(o => ({ id: o.id, label: o.label }))}
          />
        ) : bets.length === 0 ? (
          <EmptyState
            icon="analytics-outline"
            title={t("noBetsYet")}
            description={t("beFirstToPredict")}
          />
        ) : (
          <>
            {/* Overview Section with Chart */}
            <View style={[styles.overviewSection, { backgroundColor: theme.surface }]}>
              <View style={styles.chartHeader}>
                <AppText variant="label" color="secondary" style={{ letterSpacing: 0.5, textTransform: "uppercase" }}>
                  {t("probabilityHistory")}
                </AppText>
                <View style={[styles.statusBadge, market.status === "open" && { backgroundColor: isPlayMode ? '#E7F3FF' : '#E7FFE7' }]}>
                  <AppText
                    variant="caption"
                    style={{
                      fontWeight: '400',
                      color: market.status === "open" ? (isPlayMode ? theme.primary : theme.success) : theme.textSecondary,
                    }}
                  >
                    {(market.status || 'open').toUpperCase()}
                  </AppText>
                </View>
              </View>

              <View style={styles.chartContainer}>
                <LineChart
                  dataSet={chartData}
                  height={180}
                  width={CHART_WIDTH} // Reduce width for left axis space
                  noOfSections={4}
                  areaChart={false}
                  spacing={SPACING_WIDTH / Math.max(bets.length - 1, 1)} // Adjusted spacing logic
                  initialSpacing={0}
                  endSpacing={40} // Balanced end spacing
                  color="transparent"
                  thickness={1.5}
                  hideRules
                  yAxisColor="transparent"
                  showVerticalLines={false}
                  xAxisThickness={0}
                  yAxisOffset={0}
                  maxValue={100}
                  yAxisLabelSuffix="%"
                  yAxisTextStyle={{ color: theme.textSecondary, fontSize: 10 }}
                  yAxisSide={0} // 0: Left, 1: Right (enum)
                  pointerConfig={{
                    pointerStripHeight: 180,
                    pointerStripColor: theme.border,
                    pointerStripWidth: 2,
                    strokeDashArray: [2, 5],
                    pointerColor: isPlayMode ? theme.primary : theme.success,
                    radius: 4,
                    pointerLabelWidth: 120, // Required for auto-adjust to work
                    autoAdjustPointerLabelPosition: true,
                    pointerLabelComponent: (items: any) => {
                      return (
                        <View style={[styles.pointerLabel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                          {items.map((item: any, idx: number) => (
                            <View key={idx} style={styles.pointerRow}>
                              <View style={[styles.pointerDot, { backgroundColor: item.color }]} />
                              <AppText variant="caption" style={{ fontWeight: '400' }}>
                                {item.value.toFixed(1)}%
                              </AppText>
                            </View>
                          ))}
                        </View>
                      );
                    },
                  }}
                />
              </View>

              <View style={styles.overviewLegend}>
                {optionGroups.map((group) => (
                  <View key={group.option.id} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: group.color }]} />
                    <AppText variant="caption" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {group.option.label}
                    </AppText>
                    <AppText variant="caption" style={{ fontWeight: '400', color: group.color }}>
                      {group.percentage.toFixed(0)}%
                    </AppText>
                  </View>
                ))}
              </View>
            </View>

            {/* Per Option Breakdown */}
            {optionGroups.map((group) => (
              <View key={group.option.id} style={[styles.optionSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.optionHeader}>
                  <View style={styles.optionTitleRow}>
                    <View style={[styles.optionIndicator, { backgroundColor: group.color }]} />
                    <AppText variant="body" style={{ fontWeight: '400' }}>{group.option.label}</AppText>
                  </View>
                  <AppText variant="bodySm" style={{ fontWeight: '400' }}>{formatCurrency(group.total)}</AppText>
                </View>

                {group.bets.length === 0 ? (
                  <AppText variant="bodySm" color="secondary" style={{ fontStyle: "italic", textAlign: "center" }}>
                    {t("noBetsOnOption")}
                  </AppText>
                ) : (
                  <View style={styles.barsContainer}>
                    {group.bets.map((bet) => {
                      const barWidth = group.total > 0 ? (bet.totalAmount / group.total) * 100 : 0;
                      return (
                        <View key={`${bet.userId}-${bet.optionId}`} style={styles.barRow}>
                          <View style={styles.barInfo}>
                            <View style={[styles.userDot, { backgroundColor: bet.color }]} />
                            <AppText variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                              {bet.username}
                            </AppText>
                          </View>
                          <View style={[styles.barWrapper, { backgroundColor: isDark ? theme.background : "#F2F2F7" }]}>
                            <View
                              style={[
                                styles.bar,
                                { width: `${Math.max(barWidth, 4)}%`, backgroundColor: group.color }
                              ]}
                            />
                          </View>
                          <AppText variant="caption">{formatCurrency(bet.totalAmount)}</AppText>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            ))}

            {/* Participants List */}
            <View style={styles.participantsSection}>
              <AppText variant="label" color="secondary" style={{ letterSpacing: 0.5, textTransform: "uppercase" }}>
                {t("participants", { count: new Set(bets.map((b) => b.user_id)).size })}
              </AppText>
              <View style={[styles.participantsList, { backgroundColor: theme.surface }]}>
                {Array.from(userColorMap.entries()).map(([userId, color]) => {
                  const userBet = bets.find((b) => b.user_id === userId);
                  const username = userBet?.user?.username || userBet?.user?.email?.split("@")[0] || "Anonymous";
                  const userTotal = bets
                    .filter((b) => b.user_id === userId)
                    .reduce((sum, b) => sum + b.amount, 0);

                  return (
                    <View key={userId} style={[styles.participantRow, { borderBottomColor: theme.border }]}>
                      <View style={[styles.participantDot, { backgroundColor: color }]} />
                      <AppText variant="body">{username}</AppText>
                      <AppText variant="body">{formatCurrency(userTotal)}</AppText>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </AppScreen>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7", // iOS background
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 40 : 16,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#C6C6C8",
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  backButtonText: {
    fontSize: 24,
    color: Brand.primary,
    fontWeight: "400",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "400",
    color: "#000",
    marginLeft: 8,
  },
  questionSection: {
    padding: 20,
    backgroundColor: "#fff",
  },
  question: {
    fontSize: 22,
    fontWeight: '400',
    color: "#000",
    letterSpacing: -0.5,
    lineHeight: 28,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#E5E5EA",
  },
  statusOpen: {
    backgroundColor: "#E7F3FF",
  },
  statusText: {
    fontSize: 11,
    fontWeight: '400',
    color: "#8E8E93",
  },
  statusTextOpen: {
    color: Brand.primary,
  },
  poolText: {
    fontSize: 14,
    color: "#8E8E93",
    fontWeight: "400",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "400",
    color: "#8E8E93",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
  },
  overviewSection: {
    padding: 20,
    backgroundColor: "#fff",
    marginTop: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#C6C6C8",
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  chartContainer: {
    alignItems: "center",
    marginVertical: 10,
    marginLeft: 0, // Reset margin for left axis
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: "#8E8E93",
    letterSpacing: 0.5,
  },
  overviewLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 20,
    gap: 12,
    justifyContent: "center",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.03)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    maxWidth: "45%",
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendLabel: {
    fontSize: 12,
    color: "#000",
    fontWeight: "400",
    flexShrink: 1,
  },
  legendValue: {
    fontSize: 12,
    fontWeight: '400',
  },
  pointerLabel: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pointerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 2,
  },
  pointerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pointerText: {
    fontSize: 12,
    fontWeight: '400',
  },
  optionSection: {
    marginTop: 20,
    backgroundColor: "#fff",
    padding: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#C6C6C8",
  },
  optionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  optionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  optionIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: "#000",
  },
  optionTotal: {
    fontSize: 15,
    fontWeight: '400',
    color: "#000",
  },
  noBetsText: {
    fontSize: 14,
    color: "#8E8E93",
    fontStyle: "italic",
    textAlign: "center",
  },
  barsContainer: {
    gap: 16,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  barInfo: {
    flexDirection: "row",
    alignItems: "center",
    width: 100,
    gap: 8,
  },
  userDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  userName: {
    fontSize: 13,
    color: "#000",
    fontWeight: "400",
    flex: 1,
  },
  barWrapper: {
    flex: 1,
    height: 12,
    backgroundColor: "#F2F2F7",
    borderRadius: 6,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    borderRadius: 6,
  },
  barAmount: {
    fontSize: 13,
    fontWeight: "400",
    color: "#000",
    width: 70,
    textAlign: "right",
  },
  participantsSection: {
    marginTop: 20,
  },
  participantsList: {
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#C6C6C8",
    paddingHorizontal: 20,
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#C6C6C8",
  },
  participantDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  participantName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "400",
    color: "#000",
  },
  participantAmount: {
    fontSize: 15,
    fontWeight: "400",
    color: "#000",
  },
  errorText: {
    fontSize: 16,
    color: "#FF3B30",
  },
});

