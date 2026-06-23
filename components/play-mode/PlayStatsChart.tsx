import React from "react";
import { Dimensions, Platform, StyleSheet, Text, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { useTheme } from "../../contexts/ThemeContext";
import { formatCurrency } from "../../lib/parimutuel";
import type { BetWithDetails } from "../../types/market";

interface PlayStatsChartProps {
  bets: BetWithDetails[];
}

export function PlayStatsChart({ bets }: PlayStatsChartProps) {
  const { theme } = useTheme();
  const screenWidth = Dimensions.get("window").width;

  const [timeRange, setTimeRange] = React.useState<
    "1D" | "7D" | "30D" | "ALL"
  >("ALL");

  const filteredBets = React.useMemo(() => {
    const now = new Date();
    const cutoff = new Date();

    if (timeRange === "1D") cutoff.setDate(now.getDate() - 1);
    if (timeRange === "7D") cutoff.setDate(now.getDate() - 7);
    if (timeRange === "30D") cutoff.setDate(now.getDate() - 30);

    if (timeRange === "ALL") return bets;
    return bets.filter((b) => new Date(b.placed_at) >= cutoff);
  }, [bets, timeRange]);

  // Process bets into P/L history
  const sortedBets = [...filteredBets].sort(
    (a, b) =>
      new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime(),
  );

  let cumulativePL = 0;
  const data = [{ value: 0, label: "", date: "" }];

  sortedBets.forEach((bet) => {
    if (bet.markets?.status === "resolved") {
      const isWin = bet.markets.winning_option_id === bet.option_id;
      const pnl = isWin ? bet.amount : -bet.amount;
      cumulativePL += pnl;

      data.push({
        value: cumulativePL,
        label: "",
        date: new Date(bet.placed_at).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
      });
    }
  });

  const rawValues = data.map((d) => d.value);
  const minVal = Math.min(...rawValues);
  const maxVal = Math.max(...rawValues);
  const chartMin = minVal;
  const chartMax = maxVal;
  const range = chartMax - chartMin;
  const padding = range * 0.1 || 100;
  const renderMin = chartMin - padding;
  const renderMax = chartMax + padding;
  const totalRenderRange = renderMax - renderMin;

  const normalizedData = data.map((d, i) => {
    const step = Math.ceil(data.length / 4);
    const showLabel = i === 0 || i === data.length - 1 || i % step === 0;

    return {
      ...d,
      value: d.value - renderMin,
      originalValue: d.value,
      label: showLabel ? d.date : "",
    };
  });

  const noOfSections = 4;
  const stepValue = totalRenderRange / noOfSections;

  const yAxisLabelTexts = Array.from({ length: noOfSections + 1 }).map(
    (_, i) => {
      const val = renderMin + i * stepValue;
      return formatCurrency(val);
    },
  );

  const zeroLinePosition = 0 - renderMin;
  const showZeroLine =
    zeroLinePosition > 0 && zeroLinePosition < totalRenderRange;

  const yAxisLabelWidth = 50;
  const chartWidth = screenWidth - 48 - yAxisLabelWidth;
  const computedSpacing =
    normalizedData.length > 1
      ? chartWidth / (normalizedData.length - 1)
      : chartWidth;

  const noData = data.length <= 1 && cumulativePL === 0;
  const isPositive = cumulativePL >= 0;
  const lineColor = isPositive ? theme.primary : theme.error;

  const TimeButton = ({
    range: r,
    label,
  }: {
    range: "1D" | "7D" | "30D" | "ALL";
    label: string;
  }) => (
    <View style={{ flex: 1, paddingHorizontal: 4 }}>
      <Text
        onPress={() => setTimeRange(r)}
        style={[
          {
            textAlign: "center",
            fontSize: 12,
            fontWeight: '400',
            color: timeRange === r ? theme.text : theme.textSecondary,
            backgroundColor:
              timeRange === r ? theme.border : "transparent",
            paddingVertical: 6,
            borderRadius: 8,
            overflow: "hidden",
          },
          Platform.OS === "web" && ({ cursor: "pointer" } as any),
        ]}
      >
        {label}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <View style={styles.header}>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={[styles.title, { color: theme.textSecondary }]}>
            Play Performance
          </Text>
          <Text style={[styles.value, { color: lineColor }]}>
            {cumulativePL > 0 ? "+" : ""}
            {formatCurrency(cumulativePL)}
          </Text>
        </View>
      </View>

      {noData ? (
        <View
          style={[
            styles.chartContainer,
            { justifyContent: "center", alignItems: "center" },
          ]}
        >
          <Text style={{ color: theme.textSecondary }}>
            No play mode activity yet
          </Text>
        </View>
      ) : (
        <View style={styles.chartContainer}>
          <LineChart
            data={normalizedData}
            width={chartWidth}
            height={220}
            spacing={computedSpacing}
            initialSpacing={0}
            endSpacing={0}
            maxValue={totalRenderRange}
            color={lineColor}
            thickness={2}
            noOfSections={noOfSections}
            stepValue={stepValue}
            yAxisLabelTexts={yAxisLabelTexts}
            yAxisColor="transparent"
            yAxisThickness={0}
            yAxisTextStyle={{
              color: theme.textSecondary,
              fontSize: 10,
            }}
            yAxisLabelWidth={yAxisLabelWidth}
            xAxisColor={theme.border}
            xAxisThickness={1}
            xAxisLabelTextStyle={{
              color: theme.textSecondary,
              fontSize: 10,
            }}
            hideRules={false}
            rulesColor={theme.border}
            rulesType="solid"
            hideDataPoints
            showReferenceLine1={showZeroLine}
            referenceLine1Position={zeroLinePosition}
            referenceLine1Config={{
              color: theme.textSecondary,
              dashWidth: 2,
              dashGap: 4,
              thickness: 1,
            }}
            pointerConfig={{
              pointerStripUptoDataPoint: true,
              pointerStripColor: theme.textSecondary,
              pointerStripWidth: 2,
              strokeDashArray: [2, 5],
              pointerColor: lineColor,
              radius: 5,
              pointerLabelWidth: 100,
              pointerLabelHeight: 120,
              activatePointersOnLongPress: true,
              autoAdjustPointerLabelPosition: false,
              pointerComponent: () => (
                <View
                  style={{
                    height: 14,
                    width: 14,
                    borderRadius: 7,
                    backgroundColor: lineColor,
                    borderWidth: 3,
                    borderColor: theme.surface,
                  }}
                />
              ),
              pointerLabelComponent: (items: any) => {
                const item = items[0];
                return (
                  <View
                    style={{
                      height: 44,
                      width: 90,
                      backgroundColor: theme.surface,
                      borderRadius: 8,
                      justifyContent: "center",
                      alignItems: "center",
                      padding: 4,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                      elevation: 3,
                    }}
                  >
                    <Text
                      style={{
                        color: theme.textSecondary,
                        fontSize: 9,
                        marginBottom: 1,
                      }}
                    >
                      {item.date}
                    </Text>
                    <Text
                      style={{
                        color: theme.text,
                        fontWeight: '400',
                        fontSize: 13,
                      }}
                    >
                      {formatCurrency(item.originalValue)}
                    </Text>
                  </View>
                );
              },
            }}
          />
        </View>
      )}

      <View
        style={{
          flexDirection: "row",
          marginTop: 16,
          backgroundColor: theme.background,
          padding: 4,
          borderRadius: 12,
        }}
      >
        <TimeButton range="1D" label="1D" />
        <TimeButton range="7D" label="7D" />
        <TimeButton range="30D" label="30D" />
        <TimeButton range="ALL" label="ALL" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 12,
    padding: 12,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  header: {
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 12,
    fontWeight: '400',
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  value: {
    fontSize: 28,
    fontWeight: '400',
    letterSpacing: -0.5,
  },
  chartContainer: {
    height: 220,
    width: "100%",
    marginBottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
