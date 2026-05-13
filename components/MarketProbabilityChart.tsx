import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { useTheme } from "../contexts/ThemeContext";
import { supabase } from "../lib/supabase";

// Vibrant colors for chart lines
export const CHART_COLORS = [
  "#64B5F6", // Light Blue
  "#90CAF9", // Sky Blue
  "#BA68C8", // Light Violet
  "#AB47BC", // Medium Violet
  "#42A5F5", // Blue
  "#CE93D8", // Lavender
  "#2196F3", // Primary Blue
  "#9C27B0", // Deep Violet
];

interface Bet {
  option_id: string;
  amount: number;
  placed_at: string;
}

interface Option {
  id: string;
  label: string;
}

interface MarketProbabilityChartProps {
  marketId: string;
  options: Option[];
  height?: number;
  width?: number;
  showLegend?: boolean;
}

export function MarketProbabilityChart({
  marketId,
  options,
  height = 120,
  width = Dimensions.get("window").width - 48,
  showLegend = false,
}: MarketProbabilityChartProps) {
  const { isDark, theme } = useTheme();
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBets = async () => {
      try {
        const { data, error } = await supabase
          .from("bets")
          .select("option_id, amount, placed_at")
          .eq("market_id", marketId)
          .order("placed_at", { ascending: true });

        if (!error && data) {
          // Filter out any bets with null values
          const validBets = data.filter(
            (bet): bet is Bet => 
              bet.option_id !== null && 
              bet.amount !== null && 
              bet.placed_at !== null
          );
          setBets(validBets);
        }
      } catch (err) {
        console.error("Error fetching bets for chart:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBets();
  }, [marketId]);

  // Calculate probability history for the chart
  const chartData = useMemo(() => {
    if (bets.length === 0) return [];

    const runningPools = new Map<string, number>();
    options.forEach((opt) => runningPools.set(opt.id, 0));
    let runningTotal = 0;

    const historyByOption: Record<string, { value: number }[]> = {};
    options.forEach((opt) => (historyByOption[opt.id] = []));

    bets.forEach((bet) => {
      const currentAmount = runningPools.get(bet.option_id) || 0;
      runningPools.set(bet.option_id, currentAmount + bet.amount);
      runningTotal += bet.amount;

      options.forEach((opt) => {
        const optPool = runningPools.get(opt.id) || 0;
        const prob = runningTotal > 0 ? (optPool / runningTotal) * 100 : 0;
        historyByOption[opt.id].push({ value: prob });
      });
    });

    return options.map((opt, index) => {
      const color = CHART_COLORS[index % CHART_COLORS.length];
      const dataPoints = historyByOption[opt.id];
      
      // Configure data points: hide all except the last one
      const dataWithPoints = dataPoints.map((point, idx) => ({
        ...point,
        hideDataPoint: idx !== dataPoints.length - 1,
        dataPointColor: color,
        dataPointRadius: 3,
        dataPointStrokeColor: "rgba(0,0,0,0.8)",
        dataPointStrokeWidth: 1,
      }));

      return {
        data: dataWithPoints,
        color: color,
        thickness: 2,
        hideDataPoints: false,
        curved: true,
      };
    });
  }, [bets, options]);

  // Calculate current percentages for legend
  const currentPercentages = useMemo(() => {
    if (bets.length === 0) return [];

    const pools = new Map<string, number>();
    options.forEach((opt) => pools.set(opt.id, 0));
    let total = 0;

    bets.forEach((bet) => {
      const current = pools.get(bet.option_id) || 0;
      pools.set(bet.option_id, current + bet.amount);
      total += bet.amount;
    });

    return options.map((opt, index) => {
      const pool = pools.get(opt.id) || 0;
      const percentage = total > 0 ? (pool / total) * 100 : 0;
      return {
        label: opt.label,
        percentage,
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
    });
  }, [bets, options]);

  if (loading) {
    return (
      <View style={[styles.container, { height }]}>
        <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
      </View>
    );
  }

  if (bets.length === 0) {
    return (
      <View style={[styles.container, styles.emptyState, { height }]}>
        <Text style={styles.emptyText}>No bets yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.chartWrapper}>
        <LineChart
          dataSet={chartData}
          height={height}
          width={width}
          noOfSections={3}
          areaChart={false}
          spacing={Math.max((width - 40) / Math.max(bets.length - 1, 1), 2)}
          initialSpacing={10}
          endSpacing={10}
          color="transparent"
          hideRules
          yAxisColor="transparent"
          showVerticalLines={false}
          xAxisThickness={0}
          yAxisOffset={0}
          maxValue={100}
          yAxisLabelSuffix="%"
          yAxisTextStyle={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)", fontSize: 9 }}
          yAxisSide={0}
          hideDataPoints={false}
        />
      </View>

      {showLegend && (
        <View style={styles.legend}>
          {currentPercentages.map((item, index) => (
            <View key={index} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={[styles.legendLabel, { color: theme.text }]} numberOfLines={1}>
                {item.label}
              </Text>
              <Text style={[styles.legendPercentage, { color: item.color }]}>
                {item.percentage.toFixed(0)}%
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  chartWrapper: {
    alignItems: "center",
    overflow: "hidden",
  },
  emptyState: {
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    fontStyle: "italic",
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
    justifyContent: "center",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 10,
    fontWeight: "400",
    maxWidth: 60,
  },
  legendPercentage: {
    fontSize: 10,
    fontWeight: "600",
  },
});
