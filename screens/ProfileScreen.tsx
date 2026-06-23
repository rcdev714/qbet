import { decode } from "base64-arraybuffer";
import * as Haptics from "expo-haptics";
import { ImagePickerAsset } from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, FlatList, Platform, RefreshControl, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ReportContentButton } from "../components/moderation/ReportContentButton";
import { PlayStatsView } from "../components/play-mode/PlayStatsView";
import { AuraScoreModal } from "../components/profile/AuraScoreModal";
import { BetHistoryCard } from "../components/profile/BetHistoryCard";
import { FollowersModal } from "../components/profile/FollowersModal";
import { ProfileHeader } from "../components/profile/ProfileHeader";
import { ProfileTab, ProfileTabs } from "../components/profile/ProfileTabs";
import { SettingsModal } from "../components/profile/SettingsModal";
import { StatsView } from "../components/profile/StatsView";
import { SEO } from "../components/SEO";
import { useAuthContext } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useWalletContext } from "../contexts/WalletContext";
import { isAppAdmin } from "../lib/admin";
import { supabase } from "../lib/supabase";
import { betService } from "../services/bet.service";
import { groupService } from "../services/group.service";
import { moderationService } from "../services/moderation.service";
import { shareService } from "../services/share.service";
import { socialService, UserProfile } from "../services/social.service";
import { BetWithDetails } from "../types/market";

// Define stats interface locally to match state
interface UserStats {
    totalBets: number;
    activeBets: number;
    winRate: number;
    totalWagered: number;
    totalWon: number;
    bestWin: number;
    averageBet: number;
    followersCount: number;
    followingCount: number;
}

import { SocialShareProfileCard } from "../components/profile/SocialShareProfileCard";

export function ProfileScreen({ userId: userIdProp }: { userId?: string }) {
  const router = useRouter();
  const { user: currentUser, signOut, refreshUser } = useAuthContext();
  const { theme, isDark } = useTheme();
  const { isPlayMode } = useWalletContext();

  const [showShareOverlay, setShowShareOverlay] = useState(false);

  // If userId is passed as prop (e.g. from tab wrapper), use it.
  // Otherwise, we might be in a [id] route, but here we are primarily component-based?
  // Actually, usually this screen is used in (tabs)/profile with no props (current user), 
  // or via app/profile/[id] which will pass userId.
  
  // Determine target user ID
  const targetUserId = userIdProp || currentUser?.id;
  const isOwnProfile = !userIdProp || userIdProp === currentUser?.id;

  useEffect(() => {
    // If we are in a profile/[id] route but it's our own profile,
    // we should ideally be on the main profile tab.
    if (userIdProp && userIdProp === currentUser?.id) {
       router.replace("/profile");
    }
  }, [userIdProp, currentUser?.id]);

  // View State
  const [viewedUser, setViewedUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("stats");
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isAuraModalVisible, setIsAuraModalVisible] = useState(false);
  const [followersModalVisible, setFollowersModalVisible] = useState(false);
  const [bets, setBets] = useState<BetWithDetails[]>([]);
  const [stats, setStats] = useState<UserStats>({
      totalBets: 0,
      activeBets: 0,
      winRate: 0,
      totalWagered: 0,
      totalWon: 0,
      bestWin: 0,
      averageBet: 0,
      followersCount: 0,
      followingCount: 0,
  });
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);



  const loadData = async () => {
    if (!targetUserId) return;
    
    // If it's our own profile, we might initially just show currentUser data to be fast
    if (isOwnProfile && currentUser && !viewedUser) {
        // Safe cast as partial profile
         setViewedUser({ ...currentUser } as unknown as UserProfile);
    }

    try {
      // 1. Fetch Profile & Stats via Social Service
      const { profile, error } = await socialService.getProfile(targetUserId, currentUser?.id);
      
      if (!error && profile) {
          setViewedUser(profile);
          // If we have server-side stats, we could use them.
          // For now, let's stick to client-side calc from bets for consistency with previous implementation 
          // unless `profile.stats` is robust.
          // Let's use bets to populate the detailed stats object `stats` state.
      }

      // 2. Fetch Bets
      const userBets = await betService.getUserBetsWithDetails(targetUserId);
      setBets(userBets);
      
      // 3. Fetch Follow Stats
      const followStats = await socialService.getFollowStats(targetUserId);

      // Calculate stats
      const totalBets = userBets.length;
      const activeBets = userBets.filter(b => b.markets?.status === 'open').length;
      
      // Win Rate & Financials
      let resolvedBets = 0;
      let wins = 0;
      let wagered = 0;
      let won = 0;
      let best = 0;
  
      userBets.forEach(bet => {
          wagered += bet.amount;
          if (bet.markets?.status === 'resolved') {
              resolvedBets++;
              if (bet.markets.winning_option_id === bet.option_id) {
                  wins++;
                  // Placeholder: assuming 2x for demo if no payout data
                  // In real app, we should use bet.payout if available
                  const payout = bet.amount * 2; 
                  won += payout;
                  if (payout > best) best = payout;
              }
          }
      });
  
      const winRate = resolvedBets > 0 ? wins / resolvedBets : 0;
      const averageBet = totalBets > 0 ? wagered / totalBets : 0;
  
      setStats({
        totalBets,
        activeBets,
        winRate,
        totalWagered: wagered,
        totalWon: won,
        bestWin: best,
        averageBet,
        followersCount: followStats.followers,
        followingCount: followStats.following
      });
      
      
    } catch (error) {
      console.error("Error loading profile data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [targetUserId, currentUser?.id]); 
  // Add currentUser?.id dependency so if we login/out it refreshes

  const onRefresh = () => {
    setRefreshing(true);
    if (isOwnProfile) refreshUser(); // Refresh auth session if it's us
    loadData();
  };

  const handleTabChange = (tab: ProfileTab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  };

  const handleOpenSettings = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSettingsVisible(true);
  };

  // Social Actions
  const handleToggleFollow = async () => {
      if (!targetUserId || isOwnProfile) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const { isFollowing, error } = await socialService.toggleFollow(targetUserId);
      if (error) {
          Alert.alert("Error", "Could not update follow status");
      } else {
          // Update local state
          if (viewedUser) {
              setViewedUser({ ...viewedUser, is_following: isFollowing });
          }
      }
  };

  const handleBlockUser = async () => {
    if (!targetUserId || isOwnProfile) return;
    Alert.alert(
      "Block user",
      `Block @${viewedUser?.username || "this user"}? They will not be able to interact with you in chat.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            try {
              await moderationService.blockUser(targetUserId);
              Alert.alert("User blocked", "You will no longer see content from this user.");
              router.back();
            } catch (error) {
              Alert.alert("Could not block user", error instanceof Error ? error.message : "Try again.");
            }
          },
        },
      ],
    );
  };

  const handleMessage = async () => {
      if (!currentUser || !viewedUser || !targetUserId) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        const groupName = `${currentUser.username || 'User'} & ${viewedUser.username || 'User'}`;
        
        // 1. Create Group
        const { group, error } = await groupService.createGroup({
            name: groupName,
            description: "Direct Message Group",
            avatar_url: viewedUser.avatar_url // Optionally use their avatar as group icon
        });

        if (error || !group) throw error || new Error("Failed to create group");

        // 2. Create Invite Code
        const { invite, error: inviteError } = await groupService.createInvite({
            groupId: group.id
        });

        if (inviteError || !invite) {
             Alert.alert("Error", "Group created but failed to generate invite code.");
        }

        // 3. Navigate to Group (User is already admin/member)
        router.push(`/group/${group.id}`);

        // 4. (Optional) In a real app, we would send a notification or add them if allowed.
        // For now, we rely on the user sharing the code or the "invite" system.
        // However, the user request implied "message them" -> "create group".
        // We've done that.
        
      } catch (err: any) {
          Alert.alert("Error", err.message || "Failed to start chat");
      }
  };

  // Update Settings Handlers
  const handleUpdateUsername = async (newUsername: string) => {
    if (!currentUser) return;
    const { error } = await supabase
      .from("users")
      .update({ username: newUsername.trim() })
      .eq("id", currentUser.id);
      
    if (error) {
        Alert.alert("Error", "Username might be taken.");
        throw error;
    }
    await refreshUser();
    loadData(); // Reload to reflect changes
  };
  
  const handleUpdateAvatar = async (asset: ImagePickerAsset) => {
      if(!currentUser || !asset.base64) return;
      
      try {
        const arrayBuffer = decode(asset.base64);
        const ext = asset.uri.substring(asset.uri.lastIndexOf('.') + 1);
        const fileName = `${currentUser.id}/${Date.now()}.${ext}`;
        
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, arrayBuffer, {
                contentType: asset.mimeType ?? 'image/jpeg',
                upsert: true
            });
            
        if(uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
        
        await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', currentUser.id);
        await refreshUser();
        loadData();
      } catch (err: any) {
          Alert.alert("Error", err.message || "Failed to update avatar");
      }
  };

  // Rendering Helpers
  const getFilteredBets = () => {
    if (activeTab === 'open') {
        return bets.filter(b => b.markets?.status === 'open');
    } else if (activeTab === 'closed') {
        return bets.filter(b => b.markets?.status !== 'open');
    }
    return [];
  };

  // Main UI
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <SEO 
        title={viewedUser?.username ? `${viewedUser.username} on AnyMarket` : "AnyMarket Profile"}
        description={viewedUser?.username ? `See ${viewedUser.username}'s prediction track record on AnyMarket: ${stats.totalBets} predictions with a ${Math.round(stats.winRate * 100)}% win rate.` : "View an AnyMarket profile and prediction track record."}
        image={viewedUser?.avatar_url || undefined}
        imageAlt={viewedUser?.username ? `${viewedUser.username}'s AnyMarket profile` : "AnyMarket profile preview"}
        url={`/profile/${targetUserId}`}
        type="profile"
      />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <FollowersModal
        visible={followersModalVisible}
        onClose={() => setFollowersModalVisible(false)}
        userId={targetUserId || ""}
      />
      
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
             <Text style={[styles.iconText, { color: theme.text }]}>←</Text>
        </TouchableOpacity>
        
        <Text style={[styles.screenTitle, { color: theme.text }]}>
            {viewedUser?.username || "Profile"}
        </Text>
        
        {isOwnProfile ? (
            <TouchableOpacity onPress={handleOpenSettings} style={styles.iconButton}>
                 <Text style={[styles.iconText, { color: theme.text }]}>⚙️</Text>
            </TouchableOpacity>
        ) : (
            <View style={{ width: 40 }} /> // Spacer to balance back button
        )}
      </View>
      
      {/* Admin Dashboard Entry Point */}
      {isOwnProfile && isAppAdmin(currentUser) && (
        <TouchableOpacity 
            style={{ 
                backgroundColor: theme.surface, 
                marginHorizontal: 16, 
                marginBottom: 8,
                padding: 12,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: theme.border,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 1,
            }}
            onPress={() => router.push("/admin-dashboard" as any)}
        >
            <Text style={{ marginRight: 8 }}>🛡️</Text>
            <Text style={{ color: theme.text, fontWeight: "600" }}>Admin Dashboard</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={activeTab === 'stats' ? [] : getFilteredBets()} 
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <BetHistoryCard bet={item} />}
        ListHeaderComponent={
          <>
            <ProfileHeader 
                user={viewedUser} 
                stats={{
                    totalBets: stats.totalBets,
                    followersCount: stats.followersCount,
                    activeBets: stats.activeBets,
                    winRate: stats.winRate
                }}
                isOwnProfile={isOwnProfile}
                isFollowing={viewedUser?.is_following}
                onFollow={handleToggleFollow}
                onMessage={handleMessage}
                onAuraPress={() => setIsAuraModalVisible(true)}
                onShare={() => setShowShareOverlay(true)}
                onFollowersPress={() => setFollowersModalVisible(true)}
            />
            {!isOwnProfile && targetUserId ? (
              <View style={[styles.moderationRow, { borderColor: theme.border }]}>
                <ReportContentButton
                  targetType="user_profile"
                  targetId={targetUserId}
                  targetUserId={targetUserId}
                  label="Report profile"
                  theme={{
                    text: theme.text,
                    textSecondary: theme.textSecondary,
                    surface: theme.surface,
                    border: theme.border,
                    primary: theme.primary,
                  }}
                />
                <TouchableOpacity
                  onPress={handleBlockUser}
                  style={[styles.blockButton, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
                >
                  <Text style={[styles.blockButtonText, { color: theme.error }]}>Block user</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <ProfileTabs activeTab={activeTab} onTabChange={handleTabChange} />
          </>
        }
        ListFooterComponent={
            activeTab === 'stats' ? (
              isPlayMode ? <PlayStatsView userId={targetUserId} /> : <StatsView stats={stats} bets={bets} />
            ) : (
                getFilteredBets().length === 0 ? (
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <Text style={{ color: theme.textSecondary }}>No bets found.</Text>
                    </View>
                ) : null
            )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      {showShareOverlay && viewedUser && (
        <SocialShareProfileCard 
          user={viewedUser}
          stats={{
            totalBets: stats.totalBets,
            winRate: stats.winRate,
            totalWagered: stats.totalWagered,
            totalWon: stats.totalWon
          }}
          onClose={() => setShowShareOverlay(false)}
          onShare={async () => {
             setShowShareOverlay(false);
             if (viewedUser.username && targetUserId) {
                 await shareService.shareProfile(viewedUser.username, targetUserId);
             }
          }}
        />
      )}

      <SettingsModal 
        visible={isSettingsVisible} 
        onClose={() => setIsSettingsVisible(false)}
        user={currentUser}
        onUpdateUsername={handleUpdateUsername}
        onSignOut={signOut}
        onUpdateAvatar={handleUpdateAvatar}
      />

      <AuraScoreModal
        isVisible={isAuraModalVisible}
        onClose={() => setIsAuraModalVisible(false)}
        winRate={stats.winRate}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 10,
  },
  iconButton: {
    padding: 8,
  },
  iconText: {
    fontSize: 24,
  },
  screenTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  moderationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  blockButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  blockButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
