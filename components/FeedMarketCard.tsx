import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { feedService } from "@/services/feed.service";
import type { Market, MarketWithStats } from "@/types/market";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient"; // Ensure you have this or use a simple View
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { LineChart } from "react-native-gifted-charts";

interface FeedMarketCardProps {
  market: Market;
  isVisible?: boolean;
}

const { width, height } = Dimensions.get('window');
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 90 : 60;
const CARD_HEIGHT = height - TAB_BAR_HEIGHT;

export function FeedMarketCard({ market, isVisible = true }: FeedMarketCardProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useAuthContext();
  const [removing, setRemoving] = useState(false);
  
  // Rich data
  const [stats, setStats] = useState<MarketWithStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  
  // Countdown state
  const [timeLeft, setTimeLeft] = useState("");

  const viewStartTime = useRef<number | null>(null);
  
  // Fetch stats when market loads
  useEffect(() => {
    let mounted = true;
    
    const loadStats = async () => {
        try {
            const data = await feedService.getMarketWithStats(market.id);
            if (mounted && data) {
                setStats(data);
            }
        } catch (e) {
            console.error("Failed to load stats", e);
        } finally {
            if (mounted) setLoadingStats(false);
        }
    };
    
    if (isVisible) {
      loadStats();
    }

    return () => { mounted = false; };
  }, [market.id, isVisible]);

  // Engagement tracking
  useEffect(() => {
    if (isVisible && user?.id) {
      viewStartTime.current = Date.now();
    } else if (!isVisible && viewStartTime.current && user?.id) {
      const duration = Date.now() - viewStartTime.current;
      if (duration > 500) {
        feedService.trackEngagement(
          user.id,
          market.id,
          market.category || null,
          duration
        );
      }
      viewStartTime.current = null;
    }
    return () => {
      if (viewStartTime.current && user?.id) {
        const duration = Date.now() - viewStartTime.current;
        if (duration > 500) {
          feedService.trackEngagement(user.id, market.id, market.category || null, duration);
        }
      }
    };
  }, [isVisible, user?.id, market.id, market.category]);
  
  // Countdown Timer
  useEffect(() => {
    const updateTimer = () => {
      const end = new Date(market.closes_at || Date.now());
      const now = new Date();
      const diff = end.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeLeft("Closed");
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (days > 0) setTimeLeft(`${days}d ${hours}h left`);
      else if (hours > 0) setTimeLeft(`${hours}h ${mins}m left`);
      else setTimeLeft(`${mins}m left`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // minute update is enough
    return () => clearInterval(interval);
  }, [market.closes_at]);

  const adminEmail = process.env.EXPO_PUBLIC_ADMIN_EMAIL;
  const isAdmin = user?.is_admin || (user?.email && adminEmail && user.email === adminEmail);

  const handlePress = () => {
    Haptics.selectionAsync();
    router.push(`/market/${market.id}` as any);
  };

  const handleRemove = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert("Remove", "Remove this market?", [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: async () => {
             setRemoving(true);
             await feedService.toggleMarketPublicStatus(market.id, false);
        }}
    ]);
  };

  const handleOptionPress = (optionId: string) => {
    Haptics.selectionAsync();
    router.push({
        pathname: "/market/[id]",
        params: { id: market.id, optionId: optionId }
    });
  };

  return (
    <TouchableOpacity
      activeOpacity={0.98}
      onPress={handlePress}
      style={[styles.container, { backgroundColor: '#000' }]}
    >
      {/* Top Controls Overlay */}
      <View style={styles.topControls}>
        <View style={styles.badgeContainer}>
             {/* Live / Status Badge */}
             <View style={[styles.badge, styles.liveBadge]}>
                <View style={styles.liveDot} />
                <Text style={styles.badgeText}>LIVE</Text>
             </View>
             
             {/* Countdown Badge */}
             <View style={[styles.badge, styles.glassBadge]}>
               <IconSymbol name="clock" size={12} color="#fff" />
               <Text style={styles.badgeText}>{timeLeft}</Text>
             </View>
        </View>

        {isAdmin && (
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={handleRemove}
            disabled={removing}
          >
             <IconSymbol name="trash" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Main Image */}
      <View style={styles.imageContainer}>
        {market.image_url ? (
          <Image
            source={{ uri: market.image_url }}
            style={styles.image}
            contentFit="cover"
            transition={300}
          />
        ) : (
          <View style={[styles.placeholderImage, { backgroundColor: '#1A1A1A' }]}>
            <IconSymbol name="chart.bar.fill" size={40} color="#333" />
          </View>
        )}
        
        {/* Superior Gradient Overlay */}
        <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)', 'black']}
            style={styles.gradientOverlay}
        />
      </View>

      {/* Content Overlay */}
      <View style={styles.contentOverlay}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
             <View style={styles.categoryPill}>
                <Text style={styles.categoryText}>{(market.category || "General").toUpperCase()}</Text>
             </View>
             
             {/* Volume Stats */}
             {stats && (
                 <View style={styles.statRow}>
                    <IconSymbol name="dollarsign.circle.fill" size={14} color="#8E8E93" />
                    <Text style={styles.statText}>${stats.totalPool.toLocaleString()}</Text>
                    <View style={styles.divider} />
                    <IconSymbol name="person.2.fill" size={14} color="#8E8E93" />
                    <Text style={styles.statText}>{stats.betCount}</Text>
                 </View>
             )}
        </View>

        <View style={{ flex: 1 }} />

        <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
            <Text style={styles.question} numberOfLines={3}>
              {market.question}
            </Text>
        </TouchableOpacity>

        {/* Simplified Probability Graph */}
        {stats && stats.recentBets && stats.recentBets.length > 3 ? (
             <View style={styles.graphContainer}>
                {(() => {
                    // Reconstruct history for ALL options
                    const allOptions = stats.optionStats;
                    const runningPools = new Map<string, number>();
                    allOptions.forEach(o => runningPools.set(o.optionId, o.pool));
                    
                    let runningTotal = stats.totalPool;
                    
                    // Arrays to store history for each option
                    const historyMap = new Map<string, { value: number }[]>();
                    allOptions.forEach(o => historyMap.set(o.optionId, []));

                    // Helper to record current state
                    const recordState = () => {
                        allOptions.forEach(o => {
                            const pool = runningPools.get(o.optionId) || 0;
                            const pct = runningTotal > 0 ? (pool / runningTotal) * 100 : 0;
                            historyMap.get(o.optionId)?.push({ value: pct });
                        });
                    };

                    // 1. Record final state (Current)
                    recordState();

                    // 2. Work backwards from newest bet to oldest
                    // recentBets is Oldest -> Newest. So reverse to get Newest -> Oldest.
                    stats.recentBets.slice().reverse().forEach((bet) => {
                        runningTotal -= bet.amount;
                        if (runningTotal <= 0) return; // Safety

                        const currentOptPool = runningPools.get(bet.optionId) || 0;
                        runningPools.set(bet.optionId, Math.max(0, currentOptPool - bet.amount));
                        
                        recordState();
                    });

                    // 3. Build dataSet for chart
                    const dataSet = allOptions.map((opt, index) => {
                        const history = historyMap.get(opt.optionId) || [];
                        // history is Newest...Oldest. Reverse to get Oldest...Newest for chart.
                        const data = history.reverse().map((pt, idx) => ({
                            value: pt.value,
                            hideDataPoint: idx !== history.length - 1, // Only show last point
                            dataPointColor: VIBRANT_COLORS[index % VIBRANT_COLORS.length],
                            dataPointRadius: 4,
                            dataPointStrokeColor: "#fff",
                            dataPointStrokeWidth: 2,
                        }));
                        
                        // If only 1 point, duplicate it so line renders flat
                        if (data.length === 1) {
                            data.unshift({ ...data[0], hideDataPoint: true });
                        }

                        return {
                            data: data,
                            color: VIBRANT_COLORS[index % VIBRANT_COLORS.length],
                            thickness: 1.5,
                            curved: false,
                            hideDataPoints: false,
                        };
                    });

                    const axisLabelWidth = 40;
                    const chartWidth = width - 110; // Extra room for axis and margins
                    
                    return (
                        <View style={{ marginBottom: 24, paddingHorizontal: 24 }}>
                            {/* Graph Container with height buffer */}
                            <View style={{ height: 150, marginBottom: 16, paddingTop: 10, paddingBottom: 10 }} pointerEvents="none">
                                <LineChart
                                    dataSet={dataSet}
                                    height={120} // Chart body
                                    width={chartWidth}
                                    adjustToWidth
                                    initialSpacing={0}
                                    endSpacing={10}
                                    yAxisLabelWidth={axisLabelWidth}
                                    yAxisSide={0}
                                    color="transparent"
                                    thickness={1.5}
                                    hideRules
                                    yAxisColor="transparent"
                                    xAxisColor="transparent"
                                    xAxisThickness={0}
                                    yAxisThickness={0}
                                    yAxisTextStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                                    yAxisLabelSuffix="%"
                                    maxValue={100}
                                    noOfSections={2}
                                    curveType={0} 
                                    curved={false}
                                    isAnimated
                                    animationDuration={1000}
                                    hideDataPoints
                                />
                            </View>

                            <View style={styles.legendGrid}>
                                {allOptions.slice(0, 4).map((opt, index) => { // Show top 4 options max
                                    const color = VIBRANT_COLORS[index % VIBRANT_COLORS.length];
                                    return (
                                        <TouchableOpacity
                                            key={opt.optionId}
                                            style={styles.legendItem}
                                            onPress={() => handleOptionPress(opt.optionId)}
                                        >
                                            <View style={styles.legendLabelContainer}>
                                                <View style={[styles.legendDot, { backgroundColor: color }]} />
                                                <Text style={styles.legendLabel} numberOfLines={1}>{opt.label}</Text>
                                            </View>
                                            <Text style={[styles.legendPercent, { color: color }]}>
                                                {Math.round(opt.percentage)}%
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    );
                })()}
             </View>
        ) : (
             /* Fallback to Bars if not enough history */
            <View style={styles.probContainer}>
                {stats?.optionStats?.slice(0, 4).map((opt, index) => {
                    const color = VIBRANT_COLORS[index % VIBRANT_COLORS.length];
                    return (
                        <TouchableOpacity
                            key={opt.optionId}
                            style={styles.probRow}
                            onPress={() => handleOptionPress(opt.optionId)}
                        >
                            <View style={styles.probInfo}>
                                <View style={styles.probLabelContainer}>
                                    <View style={[styles.probDot, { backgroundColor: color }]} />
                                    <Text style={styles.probLabel} numberOfLines={1}>{opt.label}</Text>
                                </View>
                                <Text style={[styles.probPercent, { color: color }]}>{Math.round(opt.percentage)}%</Text>
                            </View>
                            <View style={styles.probBarTrack}>
                                <View style={[styles.probBarFill, { width: `${opt.percentage}%`, backgroundColor: color }]} />
                            </View>
                        </TouchableOpacity>
                    );
                })}
                {!stats && loadingStats && (
                    <ActivityIndicator size="small" color="#666" style={{ alignSelf: 'flex-start' }} />
                )}
            </View>
        )}
        
      </View>

        {/* Inline Betting Overlay removed */}
    </TouchableOpacity>
  );
}

// Vibrant, non-repeating colors for options
const VIBRANT_COLORS = [
  "#00D1FF", // Neon Blue
  "#FFB800", // Bright Yellow
  "#FF2D55", // Pink/Red
  "#34C759", // Emerald Green
  "#AF52DE", // Purple
  "#FF9500", // Orange
  "#5856D6", // Royal Blue
  "#007AFF", // iOS Blue
];

const styles = StyleSheet.create({
  container: {
    width: width,
    height: CARD_HEIGHT,
    position: 'relative',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  topControls: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  glassBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  liveBadge: {
    backgroundColor: '#FF3B30',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  imageContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
  },
  contentOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 140 : 120,
    paddingBottom: TAB_BAR_HEIGHT,
    zIndex: 2,
    justifyContent: 'flex-end',
  },
  categoryPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  categoryText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 2,
  },
  divider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#666',
    marginHorizontal: 4,
  },
  question: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 40,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    lineHeight: 36,
  },
  probContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  probRow: {
    width: '100%',
  },
  probInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    alignItems: 'center',
  },
  probLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  probDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  probLabel: {
    color: '#eee',
    fontSize: 18,
    fontWeight: '400',
    flex: 1, 
  },
  probPercent: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  probBarTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  probBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  graphContainer: {
    paddingHorizontal: 0,
    marginBottom: 30,
  },
  legendGrid: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 8,
    width: '100%',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
  },
  legendLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: '#ddd',
    fontSize: 16,
    fontWeight: '400',
    flex: 1,
  },
  legendPercent: {
    fontSize: 13,
    fontWeight: '700',
  },
});

