import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { calculatePotentialPayout, formatCurrency } from "@/lib/parimutuel";
import { feedService } from "@/services/feed.service";
import type { Market, MarketWithStats } from "@/types/market";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

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

  // Potential gains preview
  const [previewAmount, setPreviewAmount] = useState<string>("");
  const [selectedPreviewOption, setSelectedPreviewOption] = useState<string | null>(null);

  const viewStartTime = useRef<number | null>(null);

  // Calculate potential profit for an option
  const getPotentialProfit = (optionId: string, amount: number) => {
    if (!stats || isNaN(amount) || amount <= 0) return null;
    const option = stats.optionStats.find((opt) => opt.optionId === optionId);
    if (!option) return null;
    const result = calculatePotentialPayout(amount, option.pool, stats.totalPool, 0.0795);
    return result.potentialProfit;
  };
  
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
    const amount = previewAmount ? parseFloat(previewAmount) : undefined;
    router.push({
        pathname: "/market/[id]",
        params: { 
          id: market.id, 
          optionId: optionId,
          ...(amount && !isNaN(amount) && amount > 0 ? { previewAmount: amount.toString() } : {})
        }
    });
  };

  const handleQuickAmountSelect = (amount: number) => {
    Haptics.selectionAsync();
    setPreviewAmount(amount.toFixed(2));
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
        <View style={styles.metadataContainer}>
             <Text style={styles.categoryText}>{market.category || "General"}</Text>
             
             {/* Volume Stats */}
             {stats && (
                 <View style={styles.statRow}>
                    <View style={styles.divider} />
                    <IconSymbol name="dollarsign.circle.fill" size={16} color="#fff" />
                    <Text style={styles.statText}>${stats.totalPool.toLocaleString()}</Text>
                    <View style={styles.divider} />
                    <IconSymbol name="person.2.fill" size={16} color="#fff" />
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

        {/* Potential Gains Preview */}
        {stats ? (
          <View style={styles.potentialGainsContainer}>
            {/* Quick Amount Selector */}
            <View style={styles.amountInputRow}>
              <View style={styles.quickAmounts}>
                {[1, 5, 10, 25].map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    style={[
                      styles.quickAmountChip,
                      previewAmount === amt.toFixed(2) && styles.quickAmountChipActive
                    ]}
                    onPress={() => handleQuickAmountSelect(amt)}
                  >
                    <Text style={[
                      styles.quickAmountText,
                      previewAmount === amt.toFixed(2) && styles.quickAmountTextActive
                    ]}>
                      ${amt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.customAmountContainer}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={previewAmount}
                  onChangeText={setPreviewAmount}
                  keyboardType="numeric"
                  maxLength={6}
                />
              </View>
            </View>

            {/* Potential Wins Header */}
            {previewAmount && parseFloat(previewAmount) > 0 && (
              <View style={styles.potentialWinsHeader}>
                <IconSymbol name="sparkles" size={14} color="#FFD700" />
                <Text style={styles.potentialWinsTitle}>Potential Win</Text>
              </View>
            )}

            {/* Options with Potential Gains */}
            <View style={styles.optionsGrid}>
              {stats.optionStats.slice(0, 4).map((opt, index) => {
                const color = VIBRANT_COLORS[index % VIBRANT_COLORS.length];
                const amount = previewAmount ? parseFloat(previewAmount) : 0;
                const potentialProfit = getPotentialProfit(opt.optionId, amount);
                const hasAmount = amount > 0 && potentialProfit !== null;

                return (
                  <TouchableOpacity
                    key={opt.optionId}
                    style={[
                      styles.optionPill,
                      selectedPreviewOption === opt.optionId && styles.optionPillSelected,
                      { borderColor: selectedPreviewOption === opt.optionId ? color : 'rgba(255,255,255,0.15)' }
                    ]}
                    onPress={() => {
                      setSelectedPreviewOption(opt.optionId);
                      handleOptionPress(opt.optionId);
                    }}
                    activeOpacity={0.8}
                  >
                    {/* Background fill based on percentage */}
                    <View style={[
                      styles.optionPillFill,
                      { width: `${opt.percentage}%`, backgroundColor: color, opacity: 0.2 }
                    ]} />
                    
                    <View style={styles.optionPillContent}>
                      <View style={styles.optionPillLeft}>
                        <View style={[styles.optionDot, { backgroundColor: color }]} />
                        <Text style={styles.optionLabel} numberOfLines={1}>{opt.label}</Text>
                      </View>
                      
                      <View style={styles.optionPillRight}>
                        {hasAmount ? (
                          <View style={styles.profitBadge}>
                            <Text style={[styles.profitText, { color: '#34C759' }]}>
                              +{formatCurrency(potentialProfit!)}
                            </Text>
                          </View>
                        ) : (
                          <Text style={[styles.percentText, { color }]}>
                            {Math.round(opt.percentage)}%
                          </Text>
                        )}
                        <IconSymbol name="chevron.right" size={14} color="rgba(255,255,255,0.4)" />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Call to Action */}
            {previewAmount && parseFloat(previewAmount) > 0 && (
              <Text style={styles.ctaText}>
                Tap an option to place your bet →
              </Text>
            )}
          </View>
        ) : (
          loadingStats && (
            <View style={styles.probContainer}>
              <ActivityIndicator size="small" color="#666" style={{ alignSelf: 'center' }} />
            </View>
          )
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
  metadataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(30,30,30,0.65)',
    paddingVertical: 8,
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: 100,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
   /* removed categoryPill */
  categoryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
   /* removed creatorInfo/Text */
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    color: '#fff',
    fontSize: 16,
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
    fontWeight: '600',
    color: '#fff',
    marginBottom: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    lineHeight: 36,
    textAlign: 'center',
  },
  probContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  // Potential Gains Preview Styles
  potentialGainsContainer: {
    width: '100%',
    marginBottom: 24,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: 6,
  },
  quickAmountChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  quickAmountChipActive: {
    backgroundColor: 'rgba(0,209,255,0.2)',
    borderColor: '#00D1FF',
  },
  quickAmountText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  quickAmountTextActive: {
    color: '#00D1FF',
  },
  customAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    minWidth: 80,
  },
  dollarSign: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 4,
  },
  amountInput: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    minWidth: 50,
    padding: 0,
  },
  potentialWinsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    justifyContent: 'center',
  },
  potentialWinsTitle: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  optionsGrid: {
    gap: 8,
    width: '100%',
  },
  optionPill: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  optionPillSelected: {
    borderWidth: 2,
  },
  optionPillFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
  },
  optionPillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionPillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  optionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  optionLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  optionPillRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profitBadge: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  profitText: {
    fontSize: 14,
    fontWeight: '700',
  },
  percentText: {
    fontSize: 14,
    fontWeight: '700',
  },
  ctaText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
});

