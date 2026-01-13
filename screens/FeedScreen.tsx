import { AdminFeedManager } from "@/components/AdminFeedManager";
import { FeedMarketCard } from "@/components/FeedMarketCard";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { feedService } from "@/services/feed.service";
import type { Market } from "@/types/market";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken
} from "react-native";

export default function FeedScreen() {
  const { theme, isDark } = useTheme();
  const { user } = useAuthContext();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminModalVisible, setAdminModalVisible] = useState(false);
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());

  const adminEmail = process.env.EXPO_PUBLIC_ADMIN_EMAIL;
  const isAdmin = user?.is_admin || (user?.email && adminEmail && user.email === adminEmail);

  // Fetch feed data - use recommendations for logged-in users
  const fetchFeed = async () => {
    try {
      let publicMarkets: Market[];
      
      if (user?.id) {
        // Use personalized recommendations for logged-in users
        publicMarkets = await feedService.getRecommendedMarkets(user.id, 20);
      } else {
        // Use basic public feed for anonymous users
        publicMarkets = await feedService.getPublicMarkets(20);
      }
      
      setMarkets(publicMarkets);
    } catch (error) {
      console.error("Failed to fetch feed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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
      // Quietly refresh on new data
      fetchFeed();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]); // Re-fetch when user changes

  // Refetch when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchFeed();
    }, [user?.id])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFeed();
  }, [user?.id]);

  if (loading && markets.length === 0) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.text} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      {/* Header Overlay */}
      <View style={styles.headerOverlay}>
        {/* Admin Button */}
        {isAdmin && (
           <TouchableOpacity 
             style={styles.adminButton}
             onPress={() => setAdminModalVisible(true)}
           >
             <IconSymbol name="gear" size={24} color={theme.text} />
           </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={markets}
        renderItem={({ item }) => (
          <FeedMarketCard 
            market={item} 
            isVisible={visibleItems.has(item.id)}
          />
        )}
        keyExtractor={(item) => item.id}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        showsVerticalScrollIndicator={false}
        pagingEnabled // Snap to each card
        decelerationRate="fast"
        snapToInterval={styles.cardContainer.height} // We need to match card height
        snapToAlignment="start"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.text}
          />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={[styles.text, { color: theme.text }]}>No active public bets</Text>
            <Text style={[styles.subtext, { color: theme.textSecondary }]}>Check back later</Text>
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
    </View>
  );
}

const { width, height } = Dimensions.get('window');
// Platform.OS === 'ios' ? 88 : 60 for tab bar, plus status bar. 
// To feel natural and full, we should take most of the height.
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 90 : 60; 
const CARD_HEIGHT = height - TAB_BAR_HEIGHT; // Fill the screen minus tab bar

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    zIndex: 100,
    flexDirection: 'row',
    justifyContent: 'flex-end', // Align items to right since title is gone
    alignItems: 'center',
  },
  headerTitle: {
    // Removed qbet title
    display: 'none', 
  },
  adminButton: {
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Darker for better contrast on images
    borderRadius: 20,
    // backdropFilter removed as it's not standard RN
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
  cardContainer: {
    height: CARD_HEIGHT,
  }
});
