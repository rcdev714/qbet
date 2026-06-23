import { MarketProbabilityChart } from "@/components/MarketProbabilityChart";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useWalletContext } from "@/contexts/WalletContext";
import { usePremiumNavigation } from "@/hooks/usePremiumNavigation";
import { isAppAdmin } from "@/lib/admin";
import { alertBetPlacedWithContract } from "@/lib/bet-contract-ui";
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
    Alert,
    Animated,
    Dimensions,
    PanResponder,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShareToGroupModal } from "./ShareToGroupModal";
import { SocialShareMarketCard } from "./SocialShareMarketCard";

interface SwipeMarketCardProps {
  market: Market;
  isVisible?: boolean;
  onRemoveMarket?: (id: string) => void;
  onSwipeComplete?: (direction: 'left' | 'right') => void;
}

const { height: windowHeight } = Dimensions.get('window');
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 64;
const MAX_WEB_WIDTH = 600;
const CARD_HEIGHT = Platform.OS === 'web' ? undefined : (windowHeight - TAB_BAR_HEIGHT);

const SWIPE_THRESHOLD = 120;
const DRAG_AMOUNT_MAPPING = [10, 25, 50, 100, 250, 500];

export function SwipeMarketCard({ market, isVisible = true, onRemoveMarket, onSwipeComplete }: SwipeMarketCardProps) {
  const router = useRouter();
  const { navigate } = usePremiumNavigation();
  const { user } = useAuthContext();
  const { isDark, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = Platform.OS === 'web' ? Math.min(windowWidth, MAX_WEB_WIDTH) : windowWidth;

  const [showShareOverlay, setShowShareOverlay] = useState(false);
  const [showGroupShareModal, setShowGroupShareModal] = useState(false);

  const [baseStats, setBaseStats] = useState<MarketWithStats | null>(null);
  const [stats, setStats] = useState<MarketWithStats | null>(null);
  const { lastBetTime, isPlayMode, balance } = useWalletContext();
  const [timeLeft, setTimeLeft] = useState("");

  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const viewStartTime = useRef<number | null>(null);

  // Swipe & Stake state
  const pan = useRef(new Animated.ValueXY()).current;
  const [isDragging, setIsDragging] = useState(false);
  const [stakeIndex, setStakeIndex] = useState(0); 
  const currentStake = DRAG_AMOUNT_MAPPING[stakeIndex];
  
  // Track last Y position for haptic ticks
  const lastYRef = useRef(0);
  const lastHapticTime = useRef(0);

  // Determine market type and options
  const isBinary = stats ? isBinaryMarket(market, stats.optionStats) : false;
  const binaryOptions = stats ? getBinaryOptions(stats.optionStats) : null;
  const yesOpt = binaryOptions?.yesOption;
  const noOpt = binaryOptions?.noOption;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only trigger on significant horizontal or upward drag
        return Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10;
      },
      onPanResponderGrant: () => {
        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
        pan.setValue({ x: 0, y: 0 });
        setIsDragging(true);
        lastYRef.current = 0;
      },
      onPanResponderMove: (evt, gestureState) => {
        // X-axis follows finger (with resistance)
        // Y-axis provides resistance to keep the card somewhat centered while reading drag
        Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false })(evt, {
          ...gestureState,
          dy: gestureState.dy * 0.2 // Heavy resistance on Y axis
        });

        // Calculate stake dynamically based on Y drag
        // Dragging UP (negative dy) increases stake
        const yDiff = gestureState.dy;
        const tickThreshold = 30; // pixels per magnitude tick

        if (Math.abs(yDiff - lastYRef.current) > tickThreshold) {
            const direction = yDiff < lastYRef.current ? 1 : -1; // up = 1, down = -1
            setStakeIndex(prev => {
                const next = Math.max(0, Math.min(DRAG_AMOUNT_MAPPING.length - 1, prev + direction));
                if (next !== prev && Date.now() - lastHapticTime.current > 100) {
                    Haptics.impactAsync(direction > 0 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
                    lastHapticTime.current = Date.now();
                }
                return next;
            });
            lastYRef.current = yDiff;
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        pan.flattenOffset();
        setIsDragging(false);

        if (gestureState.dx > SWIPE_THRESHOLD) {
          // Swipe Right (YES)
          confirmBet('yes', 'right');
        } else if (gestureState.dx < -SWIPE_THRESHOLD) {
          // Swipe Left (NO)
          confirmBet('no', 'left');
        } else {
          // Snap back
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            useNativeDriver: false
          }).start();
        }
      }
    })
  ).current;

  const confirmBet = async (side: 'yes' | 'no', direction: 'left' | 'right') => {
      // Animate off screen
      Animated.timing(pan, {
          toValue: { x: direction === 'right' ? windowWidth : -windowWidth, y: 0 },
          duration: 300,
          useNativeDriver: false
      }).start(async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          
          if (onSwipeComplete) {
              onSwipeComplete(direction);
          }

          // Place the actual bet
          if (!user || !stats || !isBinary) {
              resetCard();
              return;
          }

          const optionIdToBet = side === 'yes' ? yesOpt?.optionId : noOpt?.optionId;
          if (!optionIdToBet) {
             console.error("Option ID not found for", side);
             resetCard();
             return;
          }

          if (currentStake > balance) {
              Alert.alert("Insufficient Balance", "You don't have enough funds for this bet.");
              resetCard();
              return;
          }

          // Trigger bet
          try {
             const { bet, error, contractPipeline } = await betService.placeBet({
                 marketId: market.id,
                 optionId: optionIdToBet,
                 amount: currentStake,
                 side: 'yes', // We are betting YES on the specific option (Yes or No)
                 isPlayMode
             });
             if (error) throw error;

             alertBetPlacedWithContract({
               router,
               betId: bet?.id,
               isPlayMode,
               contractPipeline,
             });
             
             // Rely on real-time subscription for global refresh to avoid custom non-existent methods
          } catch (e: any) {
              Alert.alert("Bet failed", e.message);
              resetCard();
          }
      });
  };

  const resetCard = () => {
      Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          friction: 6,
          useNativeDriver: false
      }).start();
      setStakeIndex(0);
  };

  // Calculate dynamic ROI display
  const renderROIOverlay = () => {
      if (!isDragging) return null;
      if (!stats || !isBinary || !yesOpt || !noOpt) return null;

      // Determine tentative direction based on X axis
      // Use pan.x._value directly or measure it. We need the current value.
      // Since pan is animated, we can't easily read it synchronously in render without hooks, 
      // but gestureState dx drives it. For simplicity, we interpolate.
      
      const swipeOpacityYes = pan.x.interpolate({
          inputRange: [0, SWIPE_THRESHOLD],
          outputRange: [0, 1],
          extrapolate: 'clamp'
      });
      const swipeOpacityNo = pan.x.interpolate({
          inputRange: [-SWIPE_THRESHOLD, 0],
          outputRange: [1, 0],
          extrapolate: 'clamp'
      });

      // ROI Calculation
      const yesPayout = calculateYesNoPayout(currentStake, yesOpt.yesPrice || 0.5, 0.0795).netPayout;
      const noPayout = calculateYesNoPayout(currentStake, noOpt.yesPrice || 0.5, 0.0795).netPayout;

      return (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
              {/* YES Overlay */}
              <Animated.View style={[styles.roiOverlay, styles.roiYes, { opacity: swipeOpacityYes }]}>
                 <Text style={styles.roiTitle}>BUY YES</Text>
                 <Text style={styles.roiStake}>STAKE: ${currentStake}</Text>
                 <Text style={styles.roiWin}>WIN: {formatCurrency(yesPayout)}</Text>
              </Animated.View>
              {/* NO Overlay */}
              <Animated.View style={[styles.roiOverlay, styles.roiNo, { opacity: swipeOpacityNo }]}>
                 <Text style={styles.roiTitle}>BUY NO</Text>
                 <Text style={styles.roiStake}>STAKE: ${currentStake}</Text>
                 <Text style={styles.roiWin}>WIN: {formatCurrency(noPayout)}</Text>
              </Animated.View>

              {/* Stake Indicator (Center) */}
              <View style={styles.stakeIndicatorContainer}>
                  <Text style={styles.stakeIndicatorArrow}>▲</Text>
                  <Text style={styles.stakeIndicatorText}>Drag UP to increase stake</Text>
              </View>
          </View>
      );
  };

  const loadData = useCallback(async () => {
    try {
      const marketData = await feedService.getMarketWithStats(market.id);
      if (marketData) setBaseStats(marketData);
    } catch (e) {
      console.error("Failed to load market data", e);
    }
  }, [market.id]);

  useEffect(() => {
    setStats(baseStats);
  }, [baseStats]);

  useEffect(() => {
    if (isVisible) loadData();
  }, [isVisible, loadData, lastBetTime]);

  useEffect(() => {
    if (!isVisible) return;
    const channel = supabase.channel(`market-bets-${market.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bets', filter: `market_id=eq.${market.id}` }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [market.id, isVisible, loadData]);

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
      } catch (e) { console.error(e); }
    };
    if (isVisible) loadSocialStats();
    return () => { mounted = false; };
  }, [market.id, isVisible, user]);

  useEffect(() => {
    if (isVisible && user?.id) viewStartTime.current = Date.now();
    else if (!isVisible && viewStartTime.current && user?.id) {
      const duration = Date.now() - viewStartTime.current;
      if (duration > 500) feedService.trackEngagement(user.id, market.id, market.category || null, duration);
      viewStartTime.current = null;
    }
    return () => {
      if (viewStartTime.current && user?.id) {
        const duration = Date.now() - viewStartTime.current;
        if (duration > 500) feedService.trackEngagement(user.id, market.id, market.category || null, duration);
      }
    };
  }, [isVisible, user?.id, market.id, market.category]);
  
  useEffect(() => {
    const updateTimer = () => {
      const end = new Date(market.closes_at || Date.now());
      const now = new Date();
      const diff = end.getTime() - now.getTime();
      if (diff <= 0) { setTimeLeft("Closed"); return; }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      if (days > 0) setTimeLeft(`${days}d ${hours}h left`);
      else if (hours > 0) setTimeLeft(`${hours}h ${mins}m left`);
      else setTimeLeft(`${mins}m left`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [market.closes_at]);

  const isAdmin = isAppAdmin(user);

  const handlePress = () => {
    if (isDragging) return;
    Haptics.selectionAsync();
    navigate(`/market/${market.id}`, { message: "Preparing the market..." });
  };

  const handlePracticeBet = () => {
    Haptics.selectionAsync();
    navigate({
      pathname: "/market/[id]",
      params: {
        id: market.id,
        previewAmount: "10",
        optionId: yesOpt?.optionId,
        side: "yes",
      },
    } as any, { message: "Preparing a practice bet..." });
  };

  const handleLike = async () => {
    if (!user) return Alert.alert("Sign in required", "Please sign in to like markets.");
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
    } else {
      setIsLiked(liked);
      setLikeCount(count);
    }
    setIsLiking(false);
  };

  const formatCount = (count: number): string => {
    if (count >= 1000000) return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return count.toString();
  };

  // Card transform animations
  const rotate = pan.x.interpolate({
    inputRange: [-windowWidth / 2, 0, windowWidth / 2],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp'
  });

  return (
    <Animated.View
        {...panResponder.panHandlers}
        style={[
            styles.container, 
            { 
               width: cardWidth,
               transform: [
                 { translateX: pan.x }, 
                 { translateY: pan.y },
                 { rotate: rotate }
               ] 
            }
        ]}
    >
      <TouchableOpacity activeOpacity={0.98} onPress={handlePress} style={StyleSheet.absoluteFill}>
        {/* Top Controls Overlay */}
        <View style={[styles.topControls, { top: insets.top + (Platform.OS === 'web' ? 20 : 60) }]}>
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
            <TouchableOpacity style={styles.iconButton} onPress={() => onRemoveMarket?.(market.id)}>
                <IconSymbol name="trash" size={16} color="#fff" />
            </TouchableOpacity>
            )}
        </View>

        {/* Main Image */}
        <View style={styles.imageContainer}>
            {market.image_url ? (
            <Image source={{ uri: market.image_url }} style={styles.image} contentFit="cover" transition={300} />
            ) : (
            <View style={[styles.placeholderImage, { backgroundColor: '#1A1A1A' }]}><IconSymbol name="chart.bar.fill" size={40} color="#333" /></View>
            )}
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)']} style={styles.gradientOverlay} />
        </View>

        {/* Content Overlay */}
        <View style={styles.contentOverlay}>
            <View style={styles.bottomContent}>
                <View style={styles.metadataRow}>
                    <View style={[styles.metadataContainer, { backgroundColor: isDark ? 'rgba(30,30,30,0.8)' : 'rgba(255,255,255,0.95)' }]}>
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

                <Text style={styles.question} numberOfLines={4}>{market.question}</Text>

            {/* Probability Chart */}
            {stats && isBinary && (
            <View style={styles.chartContainer}>
                <MarketProbabilityChart
                marketId={market.id}
                options={stats.optionStats.map(o => ({ id: o.optionId, label: o.label }))}
                height={50}
                width={cardWidth - 40}
                showLegend={false}
                /> 
            </View>
            )}

            {/* Constant ROI Hint / Swipe Instructions */}
            {!isDragging && isBinary && (
                <View style={styles.swipeInstructions}>
                    <View style={styles.roiHintChip}>
                        <View style={styles.roiHintSide}>
                            <IconSymbol name="arrow.left" size={14} color="#F87171" />
                            <Text style={styles.instructionText}>NO</Text>
                        </View>
                        <View style={styles.roiHintWin}>
                            <Text style={styles.winLabel}>WIN</Text>
                            <Text style={[styles.winAmount, { color: theme.success, textShadowColor: `${theme.success}66` }]}>${Math.round(calculateYesNoPayout(currentStake, noOpt?.yesPrice || 0.5, 0.0795).netPayout)}</Text>
                        </View>
                    </View>
                    <View style={styles.roiHintChip}>
                        <View style={styles.roiHintSide}>
                            <Text style={styles.instructionText}>YES</Text>
                            <IconSymbol name="arrow.right" size={14} color={theme.success} />
                        </View>
                        <View style={styles.roiHintWin}>
                            <Text style={styles.winLabel}>WIN</Text>
                            <Text style={[styles.winAmount, { color: theme.success, textShadowColor: `${theme.success}66` }]}>${Math.round(calculateYesNoPayout(currentStake, yesOpt?.yesPrice || 0.5, 0.0795).netPayout)}</Text>
                        </View>
                    </View>
                </View>
            )}

            <View style={styles.beginnerPanel}>
                <Text style={styles.beginnerTitle}>New here?</Text>
                <Text style={styles.beginnerText}>Open the market to choose an outcome, review the payout, then confirm.</Text>
                <View style={styles.beginnerActions}>
                    <TouchableOpacity
                      style={[styles.secondaryCta, { borderColor: 'rgba(255,255,255,0.22)' }]}
                      onPress={handlePress}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.secondaryCtaText}>Open market</Text>
                    </TouchableOpacity>
                    {isBinary && (
                      <TouchableOpacity
                        style={[styles.primaryCta, { backgroundColor: theme.primary }]}
                        onPress={handlePracticeBet}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.primaryCtaText}>Practice with $10</Text>
                      </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Social Row */}
            <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialButton} onPress={handleLike} activeOpacity={0.7} disabled={isLiking}>
                <IconSymbol name={isLiked ? "heart.fill" : "heart"} size={24} color={isLiked ? "#FF3B58" : "#fff"} />
                <Text style={styles.socialCount}>{formatCount(likeCount)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton} onPress={() => navigate({ pathname: "/market/[id]", params: { id: market.id, tab: "chat" } } as any, { message: "Opening live chat..." })} activeOpacity={0.7}>
                <IconSymbol name="bubble.left.fill" size={22} color="#fff" />
                <Text style={styles.socialCount}>{formatCount(commentCount)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton} onPress={() => setShowShareOverlay(true)} activeOpacity={0.7}>
                <IconSymbol name="arrowshape.turn.up.right.fill" size={22} color="#fff" />
                <Text style={styles.socialCount}>Share</Text>
            </TouchableOpacity>
            </View>
            </View>
        </View>

        {renderROIOverlay()}
      </TouchableOpacity>
      
      {showShareOverlay && (
        <SocialShareMarketCard market={market} stats={stats} onClose={() => setShowShareOverlay(false)} onShare={() => shareService.shareMarket(market)} onShareToGroup={() => { setShowShareOverlay(false); setTimeout(() => setShowGroupShareModal(true), 100); }} />
      )}
      <ShareToGroupModal visible={showGroupShareModal} onClose={() => setShowGroupShareModal(false)} marketId={market.id} marketQuestion={market.question} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: Platform.OS === 'web' ? 900 : CARD_HEIGHT,
    backgroundColor: '#000',
    overflow: 'hidden',
    alignSelf: 'center',
    borderRadius: Platform.OS === 'web' ? 24 : 0,
    marginTop: Platform.OS === 'web' ? 16 : 0,
    marginBottom: Platform.OS === 'web' ? 16 : 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  topControls: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 20, },
  badgeContainer: { flexDirection: 'row', gap: 8, },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 16, gap: 4, },
  glassBadge: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', },
  liveBadge: { backgroundColor: '#FF3B30', },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff', },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '600', letterSpacing: 0.5, },
  iconButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', },
  imageContainer: { ...StyleSheet.absoluteFillObject, zIndex: 1, },
  image: { flex: 1, width: '100%', height: '100%', backgroundColor: '#000', opacity: 1, },
  placeholderImage: { flex: 1, justifyContent: 'center', alignItems: 'center', },
  gradientOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%', },
  contentOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 2, justifyContent: 'flex-end', },
  bottomContent: { padding: 16, paddingBottom: Platform.OS === 'ios' ? 24 : 16, },
  metadataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, },
  metadataContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, },
  categoryText: { fontSize: 12, fontWeight: '400', letterSpacing: 0.5, textTransform: 'uppercase', },
  statRow: { flexDirection: 'row', alignItems: 'center', },
  divider: { width: 1, height: 12, marginHorizontal: 8, },
  statText: { fontSize: 13, fontWeight: '400', marginLeft: 4, },
  question: { fontSize: 24, fontWeight: '400', color: '#fff', marginBottom: 12, lineHeight: 28, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4, },
  chartContainer: { height: 50, marginBottom: 12, },
  swipeInstructions: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginBottom: 16 },
  roiHintChip: { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', },
  roiHintSide: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  instructionText: { color: '#fff', fontSize: 11, fontWeight: '400', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.8, },
  roiHintWin: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  winLabel: { color: '#fff', fontSize: 9, fontWeight: '300', textTransform: 'uppercase', opacity: 0.5, letterSpacing: 0.5, },
  winAmount: { fontSize: 18, fontWeight: '600', letterSpacing: 0.5, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8, },
  beginnerPanel: { backgroundColor: 'rgba(0,0,0,0.52)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 18, padding: 14, marginBottom: 14, gap: 8 },
  beginnerTitle: { color: '#fff', fontSize: 13, fontWeight: '400' },
  beginnerText: { color: 'rgba(255,255,255,0.72)', fontSize: 12, lineHeight: 17 },
  beginnerActions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  primaryCta: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  primaryCtaText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  secondaryCta: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.08)' },
  secondaryCtaText: { color: '#fff', fontSize: 13, fontWeight: '400' },
  socialRow: { flexDirection: 'row', alignItems: 'center', gap: 24, marginTop: 4 },
  socialButton: { flexDirection: 'row', alignItems: 'center', gap: 8, },
  socialCount: { color: '#fff', fontSize: 15, fontWeight: '400', },
  // ROI Overlay Styles
  roiOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 50, padding: 20, },
  roiYes: { backgroundColor: 'rgba(52, 199, 89, 0.85)', },
  roiNo: { backgroundColor: 'rgba(248, 113, 113, 0.85)', },
  roiTitle: { color: '#fff', fontSize: 48, fontWeight: '300', letterSpacing: 2, marginBottom: 20, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10, },
  roiStake: { color: '#fff', fontSize: 24, fontWeight: '300', opacity: 0.9, marginBottom: 10, },
  roiWin: { color: '#fff', fontSize: 36, fontWeight: '300', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4, },
  stakeIndicatorContainer: { position: 'absolute', right: 20, top: '40%', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 20, },
  stakeIndicatorArrow: { color: '#fff', fontSize: 24, marginBottom: 4, },
  stakeIndicatorText: { color: '#fff', fontSize: 10, fontWeight: '400', textTransform: 'uppercase', width: 60, textAlign: 'center', },
});
