import { AdminFeedManager } from "@/components/AdminFeedManager";
import { AnyMarketLoader } from "@/components/AnyMarketLoader";
import { GlobalHeader } from "@/components/GlobalHeader";
import { WebContentColumn } from "@/components/layout/WebContentColumn";
import { MarketBoardCard } from "@/components/markets/MarketBoardCard";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { SEO } from "@/components/SEO";
import { ActivityFeed } from "@/components/social/ActivityFeed";
import { SocialShareMarketCard } from "@/components/SocialShareMarketCard";
import { SwipeMarketCard } from "@/components/SwipeMarketCard";
import { AppButton, EmptyState, ErrorBanner } from "@/components/ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { DESKTOP_BREAKPOINT, MOBILE_TAB_BAR_HEIGHT } from "@/constants/layout";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { isAppAdmin } from "@/lib/admin";
import { teardownChannel } from "@/lib/supabase-realtime";
import { feedService } from "@/services/feed.service";
import type { Market } from "@/types/market";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
    ViewToken
} from "react-native";

const { height } = Dimensions.get('window');
// Match the tab bar heights from (tabs)/_layout.tsx
const TAB_BAR_HEIGHT = MOBILE_TAB_BAR_HEIGHT;
const CARD_HEIGHT = height - TAB_BAR_HEIGHT;
const IS_WEB = Platform.OS === 'web';

import { useWalletContext } from "@/contexts/WalletContext";
import { useTranslation } from "react-i18next";

export default function FeedScreen() {
  const { theme, isDark } = useTheme();
  const { user } = useAuthContext();
  const router = useRouter();
  const { t } = useTranslation("feed");
  const { t: tSocial } = useTranslation("social");
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
  const [feedTab, setFeedTab] = useState<"markets" | "following">("markets");
  const marketIdsRef = useRef("");
  const useDesktopWebFeed = Platform.OS === "web" && width >= DESKTOP_BREAKPOINT;
  const gridColumnWidth =
    width >= 1100 ? "calc((100% - 32px) / 3)" : "calc((100% - 16px) / 2)";

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
        <EmptyState
          icon="cloud-offline-outline"
          title="Markets could not load"
          description={feedError}
          actionLabel="Try again"
          onAction={() => {
            setLoading(true);
            fetchFeed();
          }}
          variant="destructive"
        />
      </View>
    );
  }

  const feedTabSegments = [
    { value: "markets" as const, label: t("tabMarkets") },
    { value: "following" as const, label: t("tabFollowing") },
  ];

  const feedTabControl = (
    <SegmentedControl compact value={feedTab} segments={feedTabSegments} onChange={setFeedTab} />
  );

  const headerRightActions = (
    <View style={styles.headerActions}>
      <NotificationBell />
      <TouchableOpacity
        style={styles.headerIconButton}
        onPress={() => router.push("/discover" as any)}
        accessibilityRole="button"
        accessibilityLabel={tSocial("openDiscover")}
      >
        <IconSymbol name="magnifyingglass" size={22} color={theme.text} />
      </TouchableOpacity>
      {isAdmin ? (
        <TouchableOpacity
          style={[styles.adminButton, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth }]}
          onPress={() => setAdminModalVisible(true)}
        >
          <IconSymbol name="gearshape" size={22} color={theme.text} />
        </TouchableOpacity>
      ) : null}
    </View>
  );

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

        <GlobalHeader right={headerRightActions} />

        {feedTab === "following" ? (
          <View style={styles.webFollowingContainer}>
            <WebContentColumn variant="social" style={styles.webFollowingHeader}>
              <View style={styles.feedTabBar}>{feedTabControl}</View>
            </WebContentColumn>
            <ActivityFeed scrollEnabled />
          </View>
        ) : (
        <ScrollView
          style={styles.webBoardScroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />
          }
        >
          <WebContentColumn
            variant="wide"
            style={styles.webBoardContent}
          >
            <View style={styles.feedTabBar}>{feedTabControl}</View>

            {
              <>
                <View style={styles.webToolbar}>
                  <Text style={[styles.webPageTitle, { color: theme.text }]}>Markets</Text>
                  <Text style={[styles.webPageSubtitle, { color: theme.textSecondary }]}>
                    {visibleMarkets.length} open
                  </Text>
                </View>

                {feedError && (
                  <ErrorBanner message={feedError} onRetry={() => fetchFeed()} retryLabel="Try again" />
                )}

                {pendingMarkets && (
                  <AppButton
                    title="Show new markets"
                    onPress={applyPendingMarkets}
                    style={styles.webNewMarkets}
                  />
                )}

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.webCategoryScroll}
                  contentContainerStyle={styles.webCategoryRow}
                >
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
                    <MarketBoardCard
                      key={market.id}
                      market={market}
                      columnWidth={gridColumnWidth}
                    />
                  ))}
                </View>

                {visibleMarkets.length === 0 && (
                  <EmptyState
                    icon="search-outline"
                    title={t("empty")}
                    description="Try another category or refresh the board."
                  />
                )}
              </>
            }
          </WebContentColumn>
        </ScrollView>
        )}

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
      
      <View style={[styles.mobileChrome, { backgroundColor: theme.surface, borderBottomColor: theme.borderSubtle }]}>
        <GlobalHeader right={headerRightActions} />
        <View style={styles.mobileFeedTabBar}>{feedTabControl}</View>
      </View>

      {feedError && markets.length > 0 && (
        <View style={styles.feedBanner}>
          <ErrorBanner message={feedError} onRetry={() => fetchFeed()} retryLabel="Try again" />
        </View>
      )}

      {pendingMarkets && feedTab === "markets" && (
        <AppButton
          title="New markets available"
          onPress={applyPendingMarkets}
          style={styles.newMarketsButton}
        />
      )}

      {feedTab === "following" ? (
        IS_WEB ? (
          <WebContentColumn variant="social">
            <ActivityFeed scrollEnabled />
          </WebContentColumn>
        ) : (
          <ActivityFeed scrollEnabled />
        )
      ) : (
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
          <EmptyState
            icon="layers-outline"
            title={t("empty")}
            description="When one appears, open it to practice before using live funds."
          />
        }
      />
      )}
      
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
  feedTabBar: {
    marginBottom: 16,
  },
  mobileChrome: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 100,
  },
  mobileFeedTabBar: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
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
    minWidth: 44,
    minHeight: 44,
    padding: 8,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconButton: {
    minWidth: 44,
    minHeight: 44,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  feedBanner: {
    position: "absolute",
    top: Platform.OS === "ios" ? 132 : 112,
    left: 20,
    right: 20,
    zIndex: 250,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  feedBannerText: {
    fontSize: 13,
    fontWeight: '400',
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
    fontWeight: '400',
  },
  center: {
    height: CARD_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 20,
    fontWeight: '400',
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
    fontWeight: '400',
  },
  webFollowingContainer: {
    flex: 1,
  },
  webFollowingHeader: {
    paddingTop: 12,
    paddingBottom: 0,
  },
  webBoardScroll: {
    flex: 1,
  },
  webBoardContent: {
    paddingTop: 12,
    paddingBottom: 96,
    gap: 14,
  },
  webToolbar: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  webPageTitle: {
    fontSize: 22,
    fontWeight: "400",
    letterSpacing: -0.3,
  },
  webPageSubtitle: {
    fontSize: 13,
    fontWeight: "500",
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
    fontWeight: '400',
  },
  webSmallButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  webSmallButtonText: {
    fontSize: 12,
    fontWeight: '400',
  },
  webNewMarkets: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
    alignSelf: "flex-start",
  },
  webNewMarketsText: {
    fontSize: 13,
    fontWeight: '400',
  },
  webCategoryScroll: {
    flexGrow: 0,
    alignSelf: "flex-start",
  },
  webCategoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 2,
  },
  webCategoryChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignSelf: "flex-start",
    justifyContent: "center",
    alignItems: "center",
  },
  webCategoryText: {
    fontSize: 13,
    fontWeight: '400',
  },
  webGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
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
    fontWeight: '400',
    letterSpacing: 0.5,
  },
});
