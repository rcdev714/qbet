import { AdminFeedManager } from "@/components/AdminFeedManager";
import { AnyMarketLoader } from "@/components/AnyMarketLoader";
import { GlobalHeader } from "@/components/GlobalHeader";
import { SEO } from "@/components/SEO";
import { SocialShareMarketCard } from "@/components/SocialShareMarketCard";
import { SwipeMarketCard } from "@/components/SwipeMarketCard";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { usePremiumNavigation } from "@/hooks/usePremiumNavigation";
import { isAppAdmin } from "@/lib/admin";
import { getBinaryOptions, isBinaryMarket } from "@/lib/market-utils";
import { formatCurrency } from "@/lib/parimutuel";
import { teardownChannel } from "@/lib/supabase-realtime";
import { feedService } from "@/services/feed.service";
import type { Market, MarketWithStats } from "@/types/market";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
    ViewStyle,
    ViewToken
} from "react-native";

const { height } = Dimensions.get('window');
// Match the tab bar heights from (tabs)/_layout.tsx
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 64; 
const CARD_HEIGHT = height - TAB_BAR_HEIGHT;
const IS_WEB = Platform.OS === 'web';

import { useWalletContext } from "@/contexts/WalletContext";
import { useTranslation } from "react-i18next";

function getMarketTimeLabel(closesAt: string | null, t: (key: string, opts?: Record<string, unknown>) => string) {
  if (!closesAt) return t("noCloseDate");
  const closeDate = new Date(closesAt);
  if (Number.isNaN(closeDate.getTime())) return t("noCloseDate");

  const diff = closeDate.getTime() - Date.now();
  if (diff <= 0) return t("closed");

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return t("daysHoursLeft", { days, hours });
  if (hours > 0) return t("hoursLeft", { hours });
  return t("closingSoon");
}

function normalizePercentage(value: number | undefined, fallback = 50) {
  if (!Number.isFinite(value)) return fallback;
  if ((value ?? 0) <= 1) return Math.round((value ?? 0) * 100);
  return Math.round(value ?? fallback);
}

function DesktopMarketTile({ market }: { market: Market }) {
  const { navigate } = usePremiumNavigation();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation("feed");
  const [stats, setStats] = useState<MarketWithStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      setStatsLoading(true);
      try {
        const nextStats = await feedService.getMarketWithStats(market.id);
        if (!cancelled) setStats(nextStats);
      } catch (error) {
        console.error("Failed to load desktop market stats", error);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };

    loadStats();

    return () => {
      cancelled = true;
    };
  }, [market.id]);

  const options = stats?.optionStats ?? [];
  const binary = stats ? isBinaryMarket(stats, options) : false;
  const binaryOptions = binary ? getBinaryOptions(options) : null;
  const yesPercent = binaryOptions ? normalizePercentage(binaryOptions.yesOption.percentage) : 50;
  const noPercent = 100 - yesPercent;
  const topOptions = options.slice(0, 2);
  const pool = stats?.totalPool ?? 0;
  const imageUrl = market.image_url?.trim();
  const canRenderImage = Boolean(imageUrl && (/^https?:\/\//i.test(imageUrl) || imageUrl.startsWith("data:")));

  const openMarket = () => navigate(`/market/${market.id}`, { message: "Preparing the market..." });
  const tradeBinary = (side: "yes" | "no") => {
    const optionId = side === "yes" ? binaryOptions?.yesOption.optionId : binaryOptions?.noOption.optionId;
    navigate({
      pathname: "/market/[id]",
      params: {
        id: market.id,
        ...(optionId ? { optionId } : {}),
        side,
      },
    } as any, { message: "Opening live prices..." });
  };

  return (
    <TouchableOpacity
      style={[
        styles.webMarketCard,
        { backgroundColor: theme.surface, borderColor: theme.border },
        isPressed && styles.webMarketCardPressed,
      ]}
      onPress={openMarket}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      activeOpacity={0.9}
    >
      <View style={styles.webMarketHeader}>
        {canRenderImage ? (
          <Image source={{ uri: imageUrl }} style={styles.webMarketImage} contentFit="cover" />
        ) : (
          <View style={[styles.webMarketImagePlaceholder, { backgroundColor: theme.card }]}>
            <Text style={[styles.webMarketImageInitial, { color: theme.primary }]}>
              {(market.category || "M").substring(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.webMarketMeta}>
          <Text style={[styles.webMarketCategory, { color: theme.primary }]} numberOfLines={1}>
            {market.category || "General"}
          </Text>
          <Text style={[styles.webMarketTime, { color: theme.textSecondary }]}>{getMarketTimeLabel(market.closes_at, t)}</Text>
        </View>
        <View style={[styles.webStatusDot, { backgroundColor: market.status === "open" ? theme.success : theme.textSecondary }]} />
      </View>

      <Text style={[styles.webMarketQuestion, { color: theme.text }]} numberOfLines={3}>
        {market.question}
      </Text>

      <View style={styles.webMarketBody}>
        {statsLoading && !stats ? (
          <View style={styles.webStatsLoading}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={[styles.webStatsLoadingText, { color: theme.textSecondary }]}>Loading prices…</Text>
          </View>
        ) : binaryOptions ? (
          <>
            <View style={[styles.webProbabilityTrack, { backgroundColor: theme.card }]}>
              <View style={[styles.webProbabilityYes, { width: `${yesPercent}%`, backgroundColor: "#2F80ED" }]} />
              <View style={[styles.webProbabilityNo, { width: `${noPercent}%`, backgroundColor: "#E6485D" }]} />
            </View>
            <View style={styles.webTradeRow}>
              <TouchableOpacity
                style={[styles.webTradeButton, styles.webYesButton]}
                onPress={(event) => {
                  event.stopPropagation();
                  tradeBinary("yes");
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.webTradeButtonLabel}>Yes</Text>
                <Text style={styles.webTradeButtonPrice}>{yesPercent}¢</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.webTradeButton, styles.webNoButton]}
                onPress={(event) => {
                  event.stopPropagation();
                  tradeBinary("no");
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.webTradeButtonLabel}>No</Text>
                <Text style={styles.webTradeButtonPrice}>{noPercent}¢</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.webOptionList}>
            {(topOptions.length > 0 ? topOptions : [{ optionId: "", label: "Open market", percentage: 0 }]).map((option) => (
              <TouchableOpacity
                key={option.optionId || option.label}
                style={[styles.webOptionRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={(event) => {
                  event.stopPropagation();
                  navigate({
                    pathname: "/market/[id]",
                    params: { id: market.id, ...(option.optionId ? { optionId: option.optionId, side: "yes" } : {}) },
                  } as any, { message: "Preparing the market..." });
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.webOptionLabel, { color: theme.text }]} numberOfLines={1}>{option.label}</Text>
                <Text style={[styles.webOptionPrice, { color: theme.primary }]}>{normalizePercentage(option.percentage, 0)}¢</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={[styles.webMarketFooter, { borderTopColor: theme.border }]}>
        <Text style={[styles.webFooterMetric, { color: theme.textSecondary }]}>Vol {formatCurrency(pool)}</Text>
        <Text style={[styles.webFooterMetric, { color: theme.textSecondary }]}>
          {options.length || 2} outcomes
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function FeedScreen() {
  const { theme, isDark } = useTheme();
  const { user } = useAuthContext();
  const { t } = useTranslation("feed");
  const { lastBetTime, isPlayMode } = useWalletContext();
  const { width } = useWindowDimensions();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminModalVisible, setAdminModalVisible] = useState(false);
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
  const flatListRef = useRef<FlatList<Market>>(null);
  const [showSharePreview, setShowSharePreview] = useState(false);
  const [previewStats, setPreviewStats] = useState<any | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [pendingMarkets, setPendingMarkets] = useState<Market[] | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const marketIdsRef = useRef("");
  const useDesktopWebFeed = Platform.OS === "web" && width >= 768;

  useEffect(() => {
    // Show one-time preview for unauthenticated users after a delay
    if (!user && markets.length > 0) {
      const timer = setTimeout(async () => {
        if (markets[0]) {
             const stats = await feedService.getMarketWithStats(markets[0].id);
             setPreviewStats(stats);
             setShowSharePreview(true);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [user, markets.length]);

  const isAdmin = isAppAdmin(user);
  const categories = useMemo(() => {
    const unique = Array.from(new Set(markets.map((market) => market.category || "General")));
    return ["All", ...unique.slice(0, 8)];
  }, [markets]);
  const visibleMarkets = useMemo(() => {
    if (selectedCategory === "All") return markets;
    return markets.filter((market) => (market.category || "General") === selectedCategory);
  }, [markets, selectedCategory]);

  const getMarketIds = (items: Market[]) => items.map((market) => market.id).join(",");

  const applyMarkets = useCallback((items: Market[]) => {
    marketIdsRef.current = getMarketIds(items);
    setMarkets(items);
  }, []);

  // Fetch feed data - use recommendations for logged-in users
  const fetchFeed = useCallback(async (options?: { deferIfChanged?: boolean }) => {
    try {
      let publicMarkets: Market[];
      
      if (user?.id) {
        // Use personalized recommendations for logged-in users
        publicMarkets = await feedService.getRecommendedMarkets(user.id, 20);
      } else {
        // Use basic public feed for anonymous users
        publicMarkets = await feedService.getPublicMarkets(20);
      }
      
      setFeedError(null);

      if (options?.deferIfChanged && marketIdsRef.current && marketIdsRef.current !== getMarketIds(publicMarkets)) {
        setPendingMarkets(publicMarkets);
      } else {
        applyMarkets(publicMarkets);
        setPendingMarkets(null);
      }
    } catch (error) {
      console.error("Failed to fetch feed:", error);
      setFeedError("We couldn't refresh markets. Check your connection and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyMarkets, user?.id]);

  // Track visible items for engagement
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const visibleIds = new Set(viewableItems.map(item => item.key));
    setVisibleItems(visibleIds);
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50, // Item is considered visible if 50% is showing
    minimumViewTime: 300 // Must be visible for at least 300ms
  }).current;

  // Initial load
  useEffect(() => {
    fetchFeed();

    // Subscribe to real-time updates
    const subscription = feedService.subscribeToPublicFeed(() => {
      fetchFeed({ deferIfChanged: true });
    });

    return () => {
      void teardownChannel(subscription);
    };
  }, [fetchFeed]);

  // Refresh feed when a bet is placed or mode changes (instant update)
  useEffect(() => {
    fetchFeed();
  }, [fetchFeed, lastBetTime, isPlayMode]);

  // Refetch when screen comes into focus without disturbing scroll position.
  useFocusEffect(
    useCallback(() => {
      fetchFeed();
    }, [fetchFeed])
  );

  // getItemLayout for consistent snap behavior
  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: CARD_HEIGHT,
      offset: CARD_HEIGHT * index,
      index,
    }),
    []
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFeed();
  }, [fetchFeed]);

  const applyPendingMarkets = useCallback(() => {
    if (!pendingMarkets) return;
    applyMarkets(pendingMarkets);
    setPendingMarkets(null);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [applyMarkets, pendingMarkets]);

  // Handle scroll to index failure (can happen if list isn't ready)
  const onScrollToIndexFailed = useCallback((info: { index: number }) => {
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
    }, 100);
  }, []);

  if (loading && markets.length === 0) {
    return <AnyMarketLoader message="Loading live markets..." />;
  }

  if (feedError && markets.length === 0) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background, paddingHorizontal: 24 }]}>
        <Text style={[styles.text, { color: theme.text, textAlign: "center" }]}>Markets could not load</Text>
        <Text style={[styles.subtext, { color: theme.textSecondary, textAlign: "center" }]}>{feedError}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: theme.primary }]}
          onPress={() => {
            setLoading(true);
            fetchFeed();
          }}
          activeOpacity={0.85}
        >
          <Text style={[styles.retryButtonText, { color: theme.onPrimary }]}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (useDesktopWebFeed) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SEO
          title="Live Social Prediction Markets"
          description="Browse live AnyMarket predictions, discover what people are forecasting, and back future outcomes with friends."
          url="/feed"
          imageAlt="AnyMarket live social prediction market feed"
        />
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

        <GlobalHeader
          right={isAdmin ? (
            <TouchableOpacity
              style={[styles.adminButton, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth }]}
              onPress={() => setAdminModalVisible(true)}
            >
              <IconSymbol name="gearshape" size={22} color={theme.text} />
            </TouchableOpacity>
          ) : undefined}
        />

        <ScrollView
          style={styles.webBoardScroll}
          contentContainerStyle={styles.webBoardContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />
          }
        >
          <View style={[styles.webHero, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.webHeroCopy}>
              <Text style={[styles.webEyebrow, { color: theme.primary }]}>PUBLIC MARKETS</Text>
              <Text style={[styles.webTitle, { color: theme.text }]}>Trade what everyone is debating.</Text>
              <Text style={[styles.webSubtitle, { color: theme.textSecondary }]}>
                A fast web board for browsing live predictions, prices, volume, and categories.
              </Text>
            </View>
            <View style={[styles.webHeroStat, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.webHeroStatValue, { color: theme.text }]}>{markets.length}</Text>
              <Text style={[styles.webHeroStatLabel, { color: theme.textSecondary }]}>open markets</Text>
            </View>
          </View>

          {feedError && (
            <View style={[styles.webInlineNotice, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.webInlineNoticeText, { color: theme.text }]}>{feedError}</Text>
              <TouchableOpacity onPress={() => fetchFeed()} style={[styles.webSmallButton, { backgroundColor: theme.primary }]}>
                <Text style={[styles.webSmallButtonText, { color: theme.onPrimary }]}>Try again</Text>
              </TouchableOpacity>
            </View>
          )}

          {pendingMarkets && (
            <TouchableOpacity
              style={[styles.webNewMarkets, { backgroundColor: theme.primary }]}
              onPress={applyPendingMarkets}
              activeOpacity={0.85}
            >
              <Text style={[styles.webNewMarketsText, { color: theme.onPrimary }]}>Show new markets</Text>
            </TouchableOpacity>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.webCategoryRow}>
            {categories.map((category) => {
              const active = selectedCategory === category;
              return (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.webCategoryChip,
                    {
                      backgroundColor: active ? theme.primarySoft : theme.surface,
                      borderColor: active ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => setSelectedCategory(category)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.webCategoryText, { color: active ? theme.primary : theme.text }]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.webGrid}>
            {visibleMarkets.map((market) => (
              <DesktopMarketTile key={market.id} market={market} />
            ))}
          </View>

          {visibleMarkets.length === 0 && (
            <View style={[styles.webEmptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.text, { color: theme.text }]}>{t("empty")}</Text>
              <Text style={[styles.subtext, { color: theme.textSecondary }]}>Try another category or refresh the board.</Text>
            </View>
          )}
        </ScrollView>

        <AdminFeedManager
          visible={adminModalVisible}
          onClose={() => {
            setAdminModalVisible(false);
            fetchFeed();
          }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SEO 
        title="Live Social Prediction Feed"
        description="See the latest AnyMarket predictions and join friends backing future outcomes in live social markets."
        url="/feed"
        imageAlt="AnyMarket live social prediction feed"
      />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      {/* Global Header with Mode Toggle */}
      <GlobalHeader
        transparent
        right={isAdmin ? (
          <TouchableOpacity
            style={[
              styles.adminButton,
              { backgroundColor: isDark ? 'rgba(1, 22, 39, 0.8)' : 'rgba(255, 255, 255, 0.9)' }
            ]}
            onPress={() => setAdminModalVisible(true)}
          >
            <IconSymbol name="gearshape" size={22} color={theme.text} />
          </TouchableOpacity>
        ) : undefined}
      />

      {feedError && markets.length > 0 && (
        <View style={[styles.feedBanner, { backgroundColor: isDark ? "rgba(255,255,255,0.9)" : "rgba(1,22,39,0.9)" }]}>
          <Text style={[styles.feedBannerText, { color: isDark ? "#011627" : "#fff" }]}>{feedError}</Text>
        </View>
      )}

      {pendingMarkets && (
        <TouchableOpacity
          style={[styles.newMarketsButton, { backgroundColor: theme.primary }]}
          onPress={applyPendingMarkets}
          activeOpacity={0.85}
        >
          <Text style={[styles.newMarketsButtonText, { color: theme.onPrimary }]}>New markets available</Text>
        </TouchableOpacity>
      )}

      <FlatList
        ref={flatListRef}
        data={markets}
        renderItem={({ item }) => (
          <SwipeMarketCard 
            market={item} 
            isVisible={visibleItems.has(item.id)}
            onRemoveMarket={(id: string) => {
              Alert.alert(
                "Remove market from public feed?",
                "This hides the market from the public feed. You can publish it again from admin tools.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Remove",
                    style: "destructive",
                    onPress: () => {
                      feedService.toggleMarketPublicStatus(id, false).then(() => fetchFeed());
                    },
                  },
                ],
              );
            }}
            onSwipeComplete={(direction: 'left' | 'right') => {
              // Move to next card automatically after swipe
              const currentIndex = markets.findIndex(m => m.id === item.id);
              if (currentIndex >= 0 && currentIndex < markets.length - 1) {
                  flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
              }
            }}
          />
        )}
        keyExtractor={(item) => item.id}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        showsVerticalScrollIndicator={false}
        pagingEnabled={!IS_WEB}
        decelerationRate={IS_WEB ? "normal" : "fast"}
        getItemLayout={IS_WEB ? undefined : getItemLayout}
        initialScrollIndex={0}
        onScrollToIndexFailed={onScrollToIndexFailed}
        // Increase dragTension to prefer horizontal pan over vertical scroll
        directionalLockEnabled={true}
        contentOffset={{ x: 0, y: 0 }}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={IS_WEB ? { paddingVertical: 20, alignItems: 'center' } : undefined}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.text}
          />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={[styles.text, { color: theme.text }]}>{t("empty")}</Text>
            <Text style={[styles.subtext, { color: theme.textSecondary }]}>When one appears, open it to practice before using live funds.</Text>
          </View>
        }
      />
      
      <AdminFeedManager 
        visible={adminModalVisible} 
        onClose={() => {
            setAdminModalVisible(false);
            fetchFeed(); // Refresh feed after admin potential changes
        }} 
      />

      {showSharePreview && markets[0] && (
        <SocialShareMarketCard 
          market={markets[0]} 
          stats={previewStats}
          onClose={() => setShowSharePreview(false)}
          onPredict={() => {
            setShowSharePreview(false);
            // This is just a preview, no action needed or could route to details
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 100,
  },
  modeToggleContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  headerTitle: {
    // Removed qbet title
    display: 'none', 
  },
  adminButton: {
    padding: 8,
    borderRadius: 20,
    // backdropFilter removed as it's not standard RN
  },
  feedBanner: {
    position: "absolute",
    top: Platform.OS === "ios" ? 104 : 84,
    left: 20,
    right: 20,
    zIndex: 250,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  feedBannerText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  newMarketsButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 104 : 84,
    alignSelf: "center",
    zIndex: 260,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  newMarketsButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  center: {
    height: CARD_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 20,
    fontWeight: "600",
  },
  subtext: {
    fontSize: 16,
    marginTop: 8,
  },
  retryButton: {
    marginTop: 20,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  webBoardScroll: {
    flex: 1,
  },
  webBoardContent: {
    width: "100%",
    maxWidth: 1440,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 96,
    gap: 18,
  },
  webHero: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    padding: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
  },
  webHeroCopy: {
    flex: 1,
    gap: 6,
  },
  webEyebrow: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
  },
  webTitle: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "600",
    letterSpacing: -0.9,
  },
  webSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 620,
  },
  webHeroStat: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    minWidth: 130,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: "center",
  },
  webHeroStatValue: {
    fontSize: 30,
    fontWeight: "600",
  },
  webHeroStatLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  webInlineNotice: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  webInlineNoticeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  webSmallButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  webSmallButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  webNewMarkets: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
    alignSelf: "flex-start",
  },
  webNewMarketsText: {
    fontSize: 13,
    fontWeight: "600",
  },
  webCategoryRow: {
    gap: 10,
    paddingVertical: 2,
  },
  webCategoryChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  webCategoryText: {
    fontSize: 13,
    fontWeight: "600",
  },
  webGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  webMarketCard: {
    // Three fixed columns: two 16px gaps between three tiles (webGrid gap).
    ...(IS_WEB
      ? ({
          width: "calc((100% - 32px) / 3)",
          maxWidth: "calc((100% - 32px) / 3)",
        } as unknown as ViewStyle)
      : ({
          width: "100%",
        } as ViewStyle)),
    flexGrow: 0,
    flexShrink: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  webMarketCardPressed: {
    transform: [{ scale: 0.985 }],
  },
  webMarketHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  webMarketImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  webMarketImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  webMarketImageInitial: {
    fontSize: 20,
    fontWeight: "600",
  },
  webMarketMeta: {
    flex: 1,
    gap: 2,
  },
  webMarketCategory: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  webMarketTime: {
    fontSize: 12,
    fontWeight: "600",
  },
  webStatusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  webMarketQuestion: {
    minHeight: 66,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  webMarketBody: {
    gap: 10,
  },
  webStatsLoading: {
    minHeight: 88,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  webStatsLoadingText: {
    fontSize: 12,
    fontWeight: "600",
  },
  webProbabilityTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    flexDirection: "row",
  },
  webProbabilityYes: {
    height: "100%",
  },
  webProbabilityNo: {
    height: "100%",
  },
  webTradeRow: {
    flexDirection: "row",
    gap: 10,
  },
  webTradeButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  webYesButton: {
    backgroundColor: "#2F80ED",
  },
  webNoButton: {
    backgroundColor: "#E6485D",
  },
  webTradeButtonLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.85,
  },
  webTradeButtonPrice: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  webOptionList: {
    gap: 8,
  },
  webOptionRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  webOptionLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  webOptionPrice: {
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  webMarketFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  webFooterMetric: {
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  webEmptyState: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 28,
    alignItems: "center",
  },
  playBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 48 : 28,
    alignSelf: 'center',
    backgroundColor: '#FF9500',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    zIndex: 200,
  },
  playBannerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
