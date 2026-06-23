import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { useTheme } from "../../contexts/ThemeContext";
import { playStatsService } from "../../services/play-stats.service";

// Same chart colors as the live version
const CHART_COLORS = [
  "#64B5F6",
  "#90CAF9",
  "#BA68C8",
  "#AB47BC",
  "#42A5F5",
  "#CE93D8",
  "#2196F3",
  "#9C27B0",
];

interface Option {
  id: string;
  label: string;
}

interface PlayMarketProbabilityChartProps {
  marketId: string;
  options: Option[];
  height?: number;
  width?: number;
  showLegend?: boolean;
}

export function PlayMarketProbabilityChart({
  marketId,
  options,
  height = 120,
  width = Dimensions.get("window").width - 48,
  showLegend = false,
}: PlayMarketProbabilityChartProps) {
  const { isDark, theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [probabilityData, setProbabilityData] = useState<{
    datasets: {
      optionId: string;
      label: string;
      data: { value: number; label: string }[];
    }[];
  }>({ datasets: [] });

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await playStatsService.getPlayProbabilityData(
          marketId,
          options,
        );
        setProbabilityData(data);
      } catch (err) {
        console.error("Error loading play probability data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [marketId, options]);

  const chartData = useMemo(() => {
    if (probabilityData.datasets.length === 0) return [];

    return probabilityData.datasets.map((ds, index) => {
      const color = CHART_COLORS[index % CHART_COLORS.length];
      const dataWithPoints = ds.data.map((point, idx) => ({
        ...point,
        hideDataPoint: idx !== ds.data.length - 1,
        dataPointColor: color,
        dataPointRadius: 3,
        dataPointStrokeColor: "rgba(0,0,0,0.8)",
        dataPointStrokeWidth: 1,
      }));

      return {
        data: dataWithPoints,
        color,
        thickness: 2,
        hideDataPoints: false,
        curved: true,
      };
    });
  }, [probabilityData]);

  const currentPercentages = useMemo(() => {
    return probabilityData.datasets.map((ds, index) => {
      const lastValue = ds.data.length > 0
        ? ds.data[ds.data.length - 1].value
        : 0;
      return {
        label: ds.label,
        percentage: lastValue,
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
    });
  }, [probabilityData]);

  if (loading) {
    return (
      <View style={[styles.container, { height }]}>
        <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
      </View>
    );
  }

  if (chartData.length === 0) {
    return (
      <View style={[styles.container, styles.emptyState, { height }]}>
        <Text style={styles.emptyText}>No play bets yet</Text>
      </View>
    );
  }

  const maxDataPoints = Math.max(
    ...chartData.map((ds) => ds.data.length),
    2,
  );
  const spacing = Math.max((width - 40) / Math.max(maxDataPoints - 1, 1), 2);

  return (
    <View style={styles.container}>
      <View style={styles.chartWrapper}>
        <LineChart
          dataSet={chartData}
          height={height}
          width={width}
          noOfSections={3}
          areaChart={false}
          spacing={spacing}
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
          yAxisTextStyle={{
            color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
            fontSize: 9,
          }}
          yAxisSide={0}
          hideDataPoints={false}
        />
      </View>

      {showLegend && (
        <View style={styles.legend}>
          {currentPercentages.map((item, index) => (
            <View key={index} style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: item.color }]}
              />
              <Text
                style={[styles.legendLabel, { color: theme.text }]}
                numberOfLines={1}
              >
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
    fontWeight: '400',
  },
});
