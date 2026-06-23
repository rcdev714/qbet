import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { useTheme } from "../../contexts/ThemeContext";
import { formatCurrency } from "../../lib/parimutuel";
import { BetWithDetails } from "../../types/market";

interface StatsChartProps {
  bets: BetWithDetails[];
}

export function StatsChart({ bets }: StatsChartProps) {
  const { theme } = useTheme();
  const screenWidth = Dimensions.get("window").width;

  // Time Range Filter
  const [timeRange, setTimeRange] = React.useState<'1D' | '7D' | '30D' | 'ALL'>('ALL');

  // Filter bets based on time range
  const filteredBets = React.useMemo(() => {
    const now = new Date();
    const cutoff = new Date();
    
    if (timeRange === '1D') cutoff.setDate(now.getDate() - 1);
    if (timeRange === '7D') cutoff.setDate(now.getDate() - 7);
    if (timeRange === '30D') cutoff.setDate(now.getDate() - 30);
    
    if (timeRange === 'ALL') return bets;

    return bets.filter(b => new Date(b.placed_at) >= cutoff);
  }, [bets, timeRange]);

  // Process bets to create P/L history from filtered list
  const sortedBets = [...filteredBets].sort((a, b) => 
    new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime()
  );

  let cumulativePL = 0;
  // If filtering by time, we should technically start from the correct P/L snapshot at that time?
  // For simplicity relative P/L in this window: start at 0.
  // OR show total accumulated? Usually charts show movement in window.
  // Let's stick to visible P/L movement in window starting from 0.
  const data = [{ value: 0, label: '', date: '' }]; 

  sortedBets.forEach((bet) => {
    if (bet.markets?.status === 'resolved') {
        const isWin = bet.markets.winning_option_id === bet.option_id;
        const pnl = isWin ? bet.amount : -bet.amount;
        cumulativePL += pnl;
        
        data.push({
            value: cumulativePL,
            label: '', 
            date: new Date(bet.placed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        });
    }
  });

  // Calculate Min/Max for correct scaling
  const rawValues = data.map(d => d.value);
  const minVal = Math.min(...rawValues);
  const maxVal = Math.max(...rawValues);
  
  // Normalize values so the lowest point is always 0 (or slightly above buffer) for the chart renderer
  // This avoids library issues with negative value scaling
  const chartMin = minVal; 
  const chartMax = maxVal;
  const range = chartMax - chartMin;
  
  // Add padding
  const padding = range * 0.1 || 100;
  const renderMin = chartMin - padding; // The visual 'floor' of the chart
  const renderMax = chartMax + padding;
  const totalRenderRange = renderMax - renderMin;

  const normalizedData = data.map((d, i) => {
      // Determine label sparsely
      const step = Math.ceil(data.length / 4);
      const showLabel = (i === 0 || i === data.length - 1 || i % step === 0);
      
      return {
          ...d,
          value: d.value - renderMin, // Shift up so everything is positive
          originalValue: d.value, // Keep track of real value for pointer
          label: showLabel ? d.date : ''
      };
  });

  const noOfSections = 4;
  const stepValue = totalRenderRange / noOfSections;
  
  // Generate Y-Axis Text manually
  // We want section labels to correspond to renderMin + i * stepValue
  const yAxisLabelTexts = Array.from({ length: noOfSections + 1 }).map((_, i) => {
      const val = renderMin + (i * stepValue);
      return formatCurrency(val);
  });

  // Zero line position (where 0 is in the shifted scale)
  const zeroLinePosition = 0 - renderMin;
  const showZeroLine = zeroLinePosition > 0 && zeroLinePosition < totalRenderRange;
  
  // Adjust chart width
  const yAxisLabelWidth = 50;
  const chartWidth = screenWidth - 48 - yAxisLabelWidth; 
  const computedSpacing = normalizedData.length > 1 ? chartWidth / (normalizedData.length - 1) : chartWidth;
  
  const noData = data.length <= 1 && cumulativePL === 0;

  const isPositive = cumulativePL >= 0;
  const lineColor = isPositive ? theme.success : theme.error;
  // Subtle gradient or just line? User asked for "candle or linear" "not smooth".
  // Stock charts often have gradient fill but let's make it very subtle or removed if linear line is focus.
  // We'll keep a very faint fill to anchor it visually, but the line is the hero.

  const TimeButton = ({ range, label }: { range: '1D' | '7D' | '30D' | 'ALL', label: string }) => (
      <View style={{ flex: 1, paddingHorizontal: 4 }}>
        <Text 
            onPress={() => setTimeRange(range)}
            style={{ 
                textAlign: 'center', 
                fontSize: 12, 
                fontWeight: '600', 
                color: timeRange === range ? theme.text : theme.textSecondary,
                backgroundColor: timeRange === range ? theme.border : 'transparent',
                paddingVertical: 6,
                borderRadius: 8,
                overflow: 'hidden'
            }}
        >
            {label}
        </Text>
      </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
        <View style={styles.header}>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={[styles.title, { color: theme.textSecondary }]}>Performance</Text>
                <Text style={[styles.value, { color: lineColor }]}>
                    {cumulativePL > 0 ? '+' : ''}{formatCurrency(cumulativePL)}
                </Text>
            </View>
        </View>
        
        {noData ? (
             <View style={[styles.chartContainer, { justifyContent: 'center', alignItems: 'center' }]}>
                 <Text style={{ color: theme.textSecondary }}>No activity in this period</Text>
             </View>
        ) : (
            <View style={styles.chartContainer}>
                <LineChart
                    data={normalizedData}
                    // areaChart // Disable area fill for cleaner "stock" look as per request
                    width={chartWidth}
                    height={220} // Increased height to fill space better as per request
                    spacing={computedSpacing}
                    initialSpacing={0}
                    endSpacing={0}
                    
                    maxValue={totalRenderRange}
                    // No mostNegativeValue needed because we normalized everything to > 0
                    
                    color={lineColor}
                    thickness={2}
                    
                    noOfSections={noOfSections}
                    stepValue={stepValue}
                    yAxisLabelTexts={yAxisLabelTexts}
                    
                    // Y-Axis Configuration
                    yAxisColor="transparent"
                    yAxisThickness={0}
                    yAxisTextStyle={{ color: theme.textSecondary, fontSize: 10 }}
                    yAxisLabelWidth={yAxisLabelWidth}
                    
                    // X-Axis Configuration
                    xAxisColor={theme.border}
                    xAxisThickness={1}
                    xAxisLabelTextStyle={{ color: theme.textSecondary, fontSize: 10 }}
                    
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
                        pointerComponent: (item: any) => {
                          return (
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
                          );
                        },
                        pointerLabelComponent: (items: any) => {
                          const item = items[0];
                          return (
                            <View
                              style={{
                                height: 44,
                                width: 90,
                                backgroundColor: theme.surface,
                                borderRadius: 8,
                                justifyContent:'center',
                                alignItems: 'center',
                                padding: 4,
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.1,
                                shadowRadius: 4,
                                elevation: 3,
                              }}
                            >
                              <Text style={{ color: theme.textSecondary, fontSize: 9, marginBottom: 1 }}>{item.date}</Text>
                              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>{formatCurrency(item.originalValue)}</Text>
                            </View>
                          );
                        },
                    }}
                />
            </View>
        )}
        
        {/* Footer with time controls */}
        <View style={{ flexDirection: 'row', marginTop: 16, backgroundColor: theme.background, padding: 4, borderRadius: 12 }}>
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
  },
  title: {
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
  },
  value: {
      fontSize: 28,
      fontWeight: '600',
      letterSpacing: -0.5,
  },
  chartContainer: {
      height: 220,
      width: '100%',
      marginBottom: 0,
      // overflow: 'hidden', // REMOVED clipping to allow pointer/shadows
      alignItems: 'center',
      justifyContent: 'center',
  }
});
