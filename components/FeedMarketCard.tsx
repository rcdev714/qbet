import { MarketProbabilityChart } from "@/components/MarketProbabilityChart";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useWalletContext } from "@/contexts/WalletContext";
import { isAppAdmin } from "@/lib/admin";
import { getBinaryOptions, isBinaryMarket } from "@/lib/market-utils";
import { calculateYesNoPayout, formatCurrency } from "@/lib/parimutuel";
import { supabase } from "@/lib/supabase";
import { betService } from "@/services/bet.service";
import { feedService } from "@/services/feed.service";
import { likeService } from "@/services/like.service";
import { shareService } from "@/services/share.service";
import type { Market, MarketWithStats } from "@/types/market";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShareToGroupModal } from "./ShareToGroupModal";
import { SocialShareMarketCard } from "./SocialShareMarketCard";

interface FeedMarketCardProps {
  market: Market;
  isVisible?: boolean;
}

const { height: windowHeight } = Dimensions.get('window');
// Match the tab bar heights from (tabs)/_layout.tsx
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 64;
const MAX_WEB_WIDTH = 600;
// const cardWidth = Platform.OS === 'web' ? Math.min(windowWidth, MAX_WEB_WIDTH) : windowWidth; // Moved to inside component
const CARD_HEIGHT = Platform.OS === 'web' ? undefined : (windowHeight - TAB_BAR_HEIGHT);

export function FeedMarketCard({ market, isVisible = true }: FeedMarketCardProps) {
  const router = useRouter();
  const { user } = useAuthContext();
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = Platform.OS === 'web' ? Math.min(windowWidth, MAX_WEB_WIDTH) : windowWidth;

  const [removing, setRemoving] = useState(false);
  const [showShareOverlay, setShowShareOverlay] = useState(false);
  const [showGroupShareModal, setShowGroupShareModal] = useState(false);
  
  // Rich data
  // Rich data
  const [baseStats, setBaseStats] = useState<MarketWithStats | null>(null);
  const [stats, setStats] = useState<MarketWithStats | null>(null);
  
  const { lastBetTime, isPlayMode } = useWalletContext();
  
  // Countdown state
  const [timeLeft, setTimeLeft] = useState("");

  // Potential gains preview
  const [previewAmount, setPreviewAmount] = useState<string>("");
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  // Social stats
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);

  const viewStartTime = useRef<number | null>(null);
  
  // Load underlying data (Base Stats + User Bets)
  const loadData = useCallback(async () => {
    try {
      // Fetch both in parallel for speed
      const [marketData, userBets] = await Promise.all([
        feedService.getMarketWithStats(market.id),
        user ? betService.getUserMarketBets(market.id) : Promise.resolve([])
      ]);

      if (marketData) {
        setBaseStats(marketData);
        // Pre-select first option if none selected
        if (!selectedOptionId && marketData.optionStats.length > 0) {
          setSelectedOptionId(marketData.optionStats[0].optionId);
        }
      }

      if (userBets) {
        // setPlayBets(userBets.filter((b: Bet) => b.is_play_mode));
      }
    } catch (e) {
      console.error("Failed to load market data", e);
    }
  }, [market.id, user, selectedOptionId]);

  // Derive Display Stats instantly
  useEffect(() => {
    // Always use base stats (Real Market Data) for display
    // We strictly do NOT merge local Play Bets into the stats anymore,
    // so the user sees the Real Market odds and the "Est Payout" is based on Real Market prices.
    setStats(baseStats);
  }, [baseStats]);

  // Initial Fetch and Refresh on bet placement
  useEffect(() => {
    if (isVisible) {
      loadData();
    }
  }, [isVisible, loadData, lastBetTime]);

  // Real-time subscription for bet updates on this market
  useEffect(() => {
    if (!isVisible) return;

    // Subscribe to bet changes (INSERT) for this specific market
    const channel = supabase
      .channel(`market-bets-${market.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bets',
          filter: `market_id=eq.${market.id}`,
        },
        () => {
          // A new bet was placed - refresh stats
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [market.id, isVisible, loadData]);

  // Fetch social stats (likes, comments)
  useEffect(() => {
    let mounted = true;

    const loadSocialStats = async () => {
      try {
        const [socialStats, liked] = await Promise.all([
          likeService.getSocialStats(market.id),
          user ? likeService.hasLiked(market.id) : Promise.resolve(false),
        ]);
        
        if (mounted) {
          setLikeCount(socialStats.likeCount);
          setCommentCount(socialStats.commentCount);
          setIsLiked(liked);
        }
      } catch (e) {
        console.error("Failed to load social stats", e);
      }
    };

    if (isVisible) {
      loadSocialStats();
    }

    return () => { mounted = false; };
  }, [market.id, isVisible, user]);

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

  const isAdmin = isAppAdmin(user);

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

  const handleTrade = (side: "yes" | "no") => {
    if (!selectedOptionId) return;
    Haptics.selectionAsync();
    const amount = previewAmount ? parseFloat(previewAmount) : undefined;
    router.push({
        pathname: "/market/[id]",
        params: { 
          id: market.id, 
          optionId: selectedOptionId,
          side: side,
          ...(amount && !isNaN(amount) && amount > 0 ? { previewAmount: amount.toString() } : {})
        }
    });
  };

  const handleQuickAmountSelect = (amount: number) => {
    Haptics.selectionAsync();
    setPreviewAmount(amount.toFixed(2));
  };

  const handleLike = async () => {
    if (!user) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Sign in required", "Please sign in to like markets.");
      return;
    }

    if (isLiking) return;

    setIsLiking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1);

    const { liked, count, error } = await likeService.toggleLike(market.id);

    if (error) {
      setIsLiked(wasLiked);
      setLikeCount(prev => wasLiked ? prev + 1 : Math.max(0, prev - 1));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      setIsLiked(liked);
      setLikeCount(count);
      if (liked) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }

    setIsLiking(false);
  };

  const handleComment = () => {
    Haptics.selectionAsync();
    router.push({
      pathname: "/market/[id]",
      params: { id: market.id, tab: "chat" }
    });
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowShareOverlay(true);
  };

  const triggerSystemShare = async () => {
    const { error } = await shareService.shareMarket(market);
    if (error) {
      console.error("Share failed:", error);
    }
    setShowShareOverlay(false);
  };

  const handleShareToGroup = () => {
    setShowShareOverlay(false); // Close the share sheet
    setTimeout(() => {
        setShowGroupShareModal(true); // Open group picker
    }, 100); // Slight delay for smoother transition
  };

  const formatCount = (count: number): string => {
    if (count >= 1000000) return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return count.toString();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.98}
      onPress={handlePress}
      style={[styles.container, { backgroundColor: '#000', width: cardWidth }]}
    >
      {/* Top Controls Overlay */}
      <View style={[styles.topControls, { top: insets.top + 60 }]}>
        <View style={styles.badgeContainer}>
             <View style={[styles.badge, styles.liveBadge]}>
                <View style={styles.liveDot} />
                <Text style={styles.badgeText}>LIVE</Text>
             </View>
             
             <View style={[styles.badge, styles.glassBadge, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)' }]}>
               <IconSymbol name="clock" size={10} color={isDark ? "#fff" : "#000"} />
               <Text style={[styles.badgeText, { color: isDark ? "#fff" : "#000" }]}>{timeLeft}</Text>
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
            style={[styles.image, { width: '100%', height: '100%' }]}
            contentFit="cover"
            transition={300}
          />
        ) : (
          <View style={[styles.placeholderImage, { backgroundColor: '#1A1A1A' }]}>
            <IconSymbol name="chart.bar.fill" size={40} color="#333" />
          </View>
        )}
        
        <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
            style={styles.gradientOverlay}
        />
      </View>

      {/* Content Overlay */}
      <View style={styles.contentOverlay}>


         {/* Bottom Content Area */}
         <View style={styles.bottomContent}>
            <View style={styles.metadataRow}>
                <View style={[styles.metadataContainer, { backgroundColor: isDark ? 'rgba(30,30,30,0.65)' : 'rgba(255,255,255,0.9)' }]}>
                    <Text style={[styles.categoryText, { color: isDark ? "#fff" : "#000" }]}>{market.category || "General"}</Text>
                    
                    {stats && (
                        <View style={styles.statRow}>
                            <View style={[styles.divider, { backgroundColor: isDark ? "#666" : "#999" }]} />
                            <IconSymbol name="dollarsign.circle.fill" size={14} color={isDark ? "#fff" : "#000"} />
                            <Text style={[styles.statText, { color: isDark ? "#fff" : "#000" }]}>${stats.totalPool.toLocaleString()}</Text>
                        </View>
                    )}
                </View>
            </View>

            <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
                <Text style={styles.question} numberOfLines={3}>
                {market.question}
                </Text>
            </TouchableOpacity>

        {/* Probability Chart - Show for binary markets */}
        {stats && isBinaryMarket(market, stats.optionStats) && (
          <View style={styles.chartContainer}>
            <MarketProbabilityChart
              marketId={market.id}
              options={stats.optionStats.map(o => ({ id: o.optionId, label: o.label }))}
              height={100}
              width={cardWidth - 40}
              showLegend={false}
            /> 
          </View>
        )}

        {/* Polymarket-style Trading Bar */}
        <View style={styles.tradingBar}>
            <View style={styles.inputSection}>
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
                
                <View style={styles.quickAmounts}>
                    {[10, 25, 50].map(amt => (
                        <TouchableOpacity 
                            key={amt} 
                            style={styles.quickChip}
                            onPress={() => handleQuickAmountSelect(amt)}
                        >
                            <Text style={styles.quickChipText}>${amt}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {previewAmount && parseFloat(previewAmount) > 0 && (
                <View style={styles.predictionPreview}>
                    {(() => {
                        const amount = parseFloat(previewAmount);
                        
                        // Check for binary market first
                        const binary = stats ? getBinaryOptions(stats.optionStats) : null;
                        
                        if (binary) {
                              const { yesOption: yesOpt, noOption: noOpt } = binary;
                              const yesPayout = calculateYesNoPayout(amount, yesOpt?.yesPrice || 0.5, 0.0795).netPayout;
                              const noPayout = calculateYesNoPayout(amount, noOpt?.yesPrice || 0.5, 0.0795).netPayout;

                              return (
                                <View style={{ flexDirection: 'row', gap: 16 }}>
                                  <Text style={styles.previewText}>
                                    Yes: <Text style={{ color: isPlayMode ? theme.primary : theme.success, fontWeight: '400', fontSize: 18 }}>{formatCurrency(yesPayout)}</Text>
                                  </Text>
                                  <Text style={styles.previewText}>
                                    No: <Text style={{ color: '#F87171', fontWeight: '400', fontSize: 18 }}>{formatCurrency(noPayout)}</Text>
                                  </Text>
                                </View>
                              );
                        }
                        
                        // Multi-option: Use selected option
                        if (!selectedOptionId || !stats) return null;
                        const opt = stats.optionStats.find(o => o.optionId === selectedOptionId);
                        const yesPrice = opt?.yesPrice || 0.5;
                        const payout = calculateYesNoPayout(amount, yesPrice, 0.0795).netPayout;

                        return (
                            <View style={{ flexDirection: 'row', justifyContent: 'center', width: '100%' }}>
                                <Text style={styles.previewText}>
                                    Est. Payout: <Text style={{ color: isPlayMode ? theme.primary : theme.success, fontWeight: '400', fontSize: 18 }}>{formatCurrency(payout)}</Text>
                                </Text>
                            </View>
                        );
                    })()}
                </View>
            )}

            <View style={styles.actionButtons}>
                 {(() => {
                    // Check for binary market first
                    const binary = stats ? getBinaryOptions(stats.optionStats) : null;

                    if (binary) {
                          const { yesOption: yesOpt, noOption: noOpt } = binary;
                      
                          const yesPrice = yesOpt ? Math.round(yesOpt.yesPrice * 100) : 50;
                          const noPrice = noOpt ? Math.round(noOpt.yesPrice * 100) : 50;
                      
                          return (
                            <>
                              <TouchableOpacity 
                                style={[
                                  styles.actionButton, 
                                  { 
                                    backgroundColor: isPlayMode ? theme.primary : theme.success, 
                                    borderColor: isPlayMode ? theme.primary : theme.success, 
                                    borderWidth: 1 
                                  }
                                ]}
                                onPress={() => {
                                  if (yesOpt) {
                                    Haptics.selectionAsync();
                                    const amount = previewAmount ? parseFloat(previewAmount) : undefined;
                                    router.push({
                                      pathname: "/market/[id]",
                                      params: { 
                                        id: market.id, 
                                        optionId: yesOpt.optionId,
                                        side: "yes",
                                        ...(amount && !isNaN(amount) && amount > 0 ? { previewAmount: amount.toString() } : {})
                                      }
                                    });
                                  }
                                }}
                              >
                                <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>Yes {yesPrice}¢</Text>
                              </TouchableOpacity>
                              <TouchableOpacity 
                                style={[styles.actionButton, { backgroundColor: '#F87171' }]}
                                onPress={() => {
                                  if (noOpt) {
                                    Haptics.selectionAsync();
                                    const amount = previewAmount ? parseFloat(previewAmount) : undefined;
                                    router.push({
                                      pathname: "/market/[id]",
                                      params: { 
                                        id: market.id, 
                                        optionId: noOpt.optionId,
                                        side: "yes",
                                        ...(amount && !isNaN(amount) && amount > 0 ? { previewAmount: amount.toString() } : {})
                                      }
                                    });
                                  }
                                }}
                              >
                                <Text style={[styles.actionButtonText, { color: '#fff' }]}>No {noPrice}¢</Text>
                              </TouchableOpacity>
                            </>
                          );
                    }
                    
                    // Multi-option: Use selected option
                    const opt = stats?.optionStats.find(o => o.optionId === selectedOptionId);
                    // Default to 50 cents if not found, but selectedOptionId check above generally handles it
                    const yesPrice = opt ? Math.round(opt.yesPrice * 100) : 50;
                    
                    return (
                        <TouchableOpacity 
                           style={[
                             styles.actionButton, 
                             { 
                               backgroundColor: isPlayMode ? theme.primary : theme.success, 
                               borderColor: isPlayMode ? theme.primary : theme.success, 
                               borderWidth: 1, 
                               flex: 1 
                             }
                           ]}
                           onPress={() => handleTrade("yes")}
                        >
                           <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>Bet {opt?.label || 'Option'} {yesPrice}¢</Text>
                        </TouchableOpacity>
                    );
                 })()}
            </View>
        </View>

        {/* Options List - Only show for multi-option markets (not binary yes/no) */}
        {stats && !isBinaryMarket(market, stats.optionStats) ? (
          <View style={styles.optionsList}>
            {stats.optionStats.slice(0, 4).map((opt, index) => {
              const isSelected = selectedOptionId === opt.optionId;
              const accentColor = isPlayMode ? theme.primary : theme.success; 

              return (
                <TouchableOpacity
                  key={opt.optionId}
                  style={[
                    styles.optionRow,
                    isSelected && styles.optionRowSelected,
                    { 
                        backgroundColor: isDark ? (isSelected ? 'rgba(30, 30, 30, 0.9)' : 'rgba(20, 20, 20, 0.85)') : (isSelected ? '#F0F9FF' : '#ffffff'),
                        borderColor: isSelected ? accentColor : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)')
                    }
                  ]}
                  onPress={() => {
                    setSelectedOptionId(opt.optionId);
                    Haptics.selectionAsync();
                  }}
                  activeOpacity={0.8}
                >
                  {/* Probability Bar */}
                  <View style={[
                      styles.optionBar, 
                      { 
                          width: `${opt.percentage}%`, 
                          backgroundColor: accentColor,
                          opacity: 0.1 // Further reduced opacity
                      }
                  ]} />
                  
                  <View style={styles.optionContent}>
                      <Text style={[styles.optionLabel, { color: isDark ? '#fff' : '#1A1A1A', fontWeight: '400' }]} numberOfLines={1}>
                        {opt.label}
                      </Text>
                      <Text style={[styles.optionPercent, { color: isSelected ? accentColor : (isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)'), fontWeight: '400' }]}>
                        {Math.round(opt.percentage)}%
                      </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : !stats ? (
            <View style={{ height: 100, justifyContent: 'center' }}>
                <ActivityIndicator color="#fff" />
            </View>
        ) : null}

        {/* Social Row - Horizontal Bottom */}
        <View style={styles.socialRow}>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleLike}
            activeOpacity={0.7}
            disabled={isLiking}
          >
            <IconSymbol
              name={isLiked ? "heart.fill" : "heart"}
              size={20}
              color={isLiked ? "#FF3B58" : "#fff"}
            />
            <Text style={styles.socialCount}>{formatCount(likeCount)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleComment}
            activeOpacity={0.7}
          >
            <IconSymbol name="bubble.left.fill" size={18} color="#fff" />
            <Text style={styles.socialCount}>{formatCount(commentCount)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleShare}
            activeOpacity={0.7}
          >
            <IconSymbol name="arrowshape.turn.up.right.fill" size={18} color="#fff" />
            <Text style={styles.socialCount}>Share</Text>
          </TouchableOpacity>
        </View>
        </View>

        {showShareOverlay && (
          <SocialShareMarketCard 
            market={market} 
            stats={stats}
            onClose={() => setShowShareOverlay(false)}
            onShare={triggerSystemShare}
            onShareToGroup={handleShareToGroup}
          />
        )}
        
        <ShareToGroupModal
            visible={showGroupShareModal}
            onClose={() => setShowGroupShareModal(false)}
            marketId={market.id}
            marketQuestion={market.question}
        />
      </View>
    </TouchableOpacity>
  );
}


const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: Platform.OS === 'web' ? undefined : CARD_HEIGHT,
    aspectRatio: Platform.OS === 'web' ? 9/16 : undefined,
    position: 'relative',
    backgroundColor: '#000',
    overflow: 'hidden',
    alignSelf: 'center', // Center on web
    borderRadius: Platform.OS === 'web' ? 12 : 0,
    marginTop: Platform.OS === 'web' ? 16 : 0,
  },
  topControls: {
    position: 'absolute',
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
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 16,
    gap: 4,
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
    fontSize: 9,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    backgroundColor: '#000',
    opacity: 1,
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
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    justifyContent: 'flex-end',
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    marginTop: 16,
    paddingTop: 8,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  socialCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '400',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bottomContent: {
    paddingHorizontal: 20,
    paddingBottom: TAB_BAR_HEIGHT + 20,
    width: '100%',
  },
  metadataRow: {
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  metadataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,30,30,0.65)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  categoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '400',
    marginLeft: 2,
  },
  divider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#666',
    marginHorizontal: 3,
  },
  question: {
    fontSize: 22,
    fontWeight: '400',
    color: '#fff',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    lineHeight: 28,
    paddingRight: 60, // Make room for right icons if needed, though they are higher up
  },
  chartContainer: {
    width: '100%',
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 12,
    paddingBottom: 8,
  },
  optionsList: {
    gap: 8,
    width: '100%',
    marginBottom: 8,
    marginTop: 16
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    height: 44,
    borderWidth: 1,
    position: 'relative',
  },
  optionRowSelected: {
    borderWidth: 2,
  },
  optionBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  optionContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  optionLabel: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  optionPercent: {
    fontSize: 14,
    fontWeight: '400',
  },
  tradingBar: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    gap: 12
  },
  inputSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    width: 100,
  },
  dollarSign: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    fontWeight: '400',
    marginRight: 4,
  },
  amountInput: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    flex: 1,
    padding: 0,
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: 8,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  quickChipText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '400',
  },
  predictionPreview: {
      flexDirection: 'row',
      justifyContent: 'center',
      paddingVertical: 4
  },
  previewText: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 12
  },
  actionButtons: {
      flexDirection: 'row',
      gap: 12
  },
  actionButton: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8
  },
  actionButtonText: {
      color: '#000',
      fontSize: 15,
      fontWeight: '400'
  },
});