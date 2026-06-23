import { AppText, EmptyState } from "@/components/ui";
import { BackButton } from "@/components/ui/BackButton";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { showAppAlertRaw } from "@/lib/ui/feedback";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Platform, RefreshControl, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from "react-native";
import { GlobalHeader } from "../components/GlobalHeader";
import { JoinGroupPanel } from "../components/groups/JoinGroupPanel";
import { WebContentColumn } from "../components/layout/WebContentColumn";
import { ReportContentButton } from "../components/moderation/ReportContentButton";
import { NotificationBell } from "../components/notifications/NotificationBell";
import { PlayStatsView } from "../components/play-mode/PlayStatsView";
import { AuraScoreModal } from "../components/profile/AuraScoreModal";
import { BetHistoryCard } from "../components/profile/BetHistoryCard";
import { FollowersModal } from "../components/profile/FollowersModal";
import { FollowingModal } from "../components/profile/FollowingModal";
import { ProfileHeader } from "../components/profile/ProfileHeader";
import { ProfileTab, ProfileTabs } from "../components/profile/ProfileTabs";
import { StatsView } from "../components/profile/StatsView";
import { UserGroupsSection } from "../components/profile/UserGroupsSection";
import { SEO } from "../components/SEO";
import { useAuthContext } from "../contexts/AuthContext";
import { useIsDesktopWebNav } from "../contexts/NavigationLayoutContext";
import { useTheme } from "../contexts/ThemeContext";
import { useWalletContext } from "../contexts/WalletContext";
import { isAppAdmin } from "../lib/admin";
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
    groupsCount: number;
}

import { SocialShareProfileCard } from "../components/profile/SocialShareProfileCard";

export function ProfileScreen({ userId: userIdProp }: { userId?: string }) {
  const router = useRouter();
  const { user: currentUser, refreshUser } = useAuthContext();
  const { theme, isDark } = useTheme();
  const { t: tTabs } = useTranslation('tabs');
  const isDesktopWebNav = useIsDesktopWebNav();
  const { isPlayMode } = useWalletContext();
  const { t } = useTranslation("settings");

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
  const [isAuraModalVisible, setIsAuraModalVisible] = useState(false);
  const [followersModalVisible, setFollowersModalVisible] = useState(false);
  const [followingModalVisible, setFollowingModalVisible] = useState(false);
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
      groupsCount: 0,
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
      let profileData: UserProfile | null = null;
      
      if (!error && profile) {
          profileData = profile;
          setViewedUser(profile);

          if (profile.stats) {
            const followStats = await socialService.getFollowStats(targetUserId);
            const groupsCount = isOwnProfile
              ? (await groupService.getAdministeredGroups()).length
              : (await groupService.getProfileGroups(targetUserId)).length;

            setStats((prev) => ({
              ...prev,
              totalBets: profile.stats?.total_bets ?? prev.totalBets,
              winRate: profile.stats?.win_rate ?? prev.winRate,
              followersCount: followStats.followers,
              followingCount: followStats.following,
              groupsCount,
            }));
          }
      }

      // 2. Fetch Bets
      const userBets = await betService.getUserBetsWithDetails(targetUserId);
      setBets(userBets);
      
      // 3. Fetch Follow Stats
      const followStats = await socialService.getFollowStats(targetUserId);
      const groupsCount = isOwnProfile
        ? (await groupService.getAdministeredGroups()).length
        : (await groupService.getProfileGroups(targetUserId)).length;

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
      const serverStats = profileData?.stats;

      setStats({
        totalBets: serverStats?.total_bets ?? totalBets,
        activeBets,
        winRate: serverStats?.win_rate ?? winRate,
        totalWagered: wagered,
        totalWon: won,
        bestWin: best,
        averageBet,
        followersCount: followStats.followers,
        followingCount: followStats.following,
        groupsCount,
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
    router.push("/settings" as any);
  };

  // Social Actions
  const handleToggleFollow = async () => {
      if (!targetUserId || isOwnProfile) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const { isFollowing, error } = await socialService.toggleFollow(targetUserId);
      if (error) {
          showAppAlertRaw("Error", "Could not update follow status");
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
        const { groupId, error } = await socialService.findOrCreateDmGroup(targetUserId);
        if (error || !groupId) throw error || new Error("Failed to start chat");
        router.push(`/group/${groupId}`);
      } catch (err: any) {
          showAppAlertRaw("Error", err.message || "Failed to start chat");
      }
  };

  const getFilteredBets = () => {
    if (activeTab === 'open') {
        return bets.filter(b => b.markets?.status === 'open');
    } else if (activeTab === 'closed') {
        return bets.filter(b => b.markets?.status !== 'open');
    }
    return [];
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
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
      <FollowingModal
        visible={followingModalVisible}
        onClose={() => setFollowingModalVisible(false)}
        userId={targetUserId || currentUser?.id || ""}
      />
      
      <GlobalHeader
        showToggle={!isDesktopWebNav}
        left={!isOwnProfile || userIdProp ? <BackButton /> : undefined}
        right={
          isOwnProfile && !isDesktopWebNav ? (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <NotificationBell />
              <TouchableOpacity
                onPress={handleOpenSettings}
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel={t("title")}
              >
                <IconSymbol name="gearshape" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
          ) : !isOwnProfile ? undefined : (
            <NotificationBell />
          )
        }
      />

      {isOwnProfile ? (
        <View style={[styles.accountActions, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={[styles.accountActionRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={handleOpenSettings}
            accessibilityRole="button"
            accessibilityLabel={t("title")}
          >
            <View style={[styles.accountActionIcon, { backgroundColor: theme.primarySoft }]}>
              <IconSymbol name="gearshape" size={18} color={theme.primary} />
            </View>
            <AppText variant="body" style={styles.accountActionLabel}>
              {t("title")}
            </AppText>
            <IconSymbol name="chevron.right" size={16} color={theme.textSecondary} />
          </TouchableOpacity>

          {isAppAdmin(currentUser) ? (
            <TouchableOpacity
              style={[styles.accountActionRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => router.push("/admin-dashboard" as any)}
              accessibilityRole="button"
              accessibilityLabel={tTabs("admin")}
            >
              <View style={[styles.accountActionIcon, { backgroundColor: theme.primarySoft }]}>
                <IconSymbol name="shield" size={18} color={theme.primary} />
              </View>
              <AppText variant="body" style={styles.accountActionLabel}>
                {tTabs("admin")}
              </AppText>
              <IconSymbol name="chevron.right" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <WebContentColumn variant="social" style={{ flex: 1 }}>
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />
          }
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          <ProfileHeader
            user={viewedUser}
            stats={{
              totalBets: stats.totalBets,
              followersCount: stats.followersCount,
              followingCount: stats.followingCount,
              groupsCount: stats.groupsCount,
              activeBets: stats.activeBets,
              winRate: stats.winRate,
            }}
            isOwnProfile={isOwnProfile}
            isFollowing={viewedUser?.is_following}
            onFollow={handleToggleFollow}
            onMessage={handleMessage}
            onAuraPress={() => setIsAuraModalVisible(true)}
            onShare={() => setShowShareOverlay(true)}
            onFollowersPress={() => setFollowersModalVisible(true)}
            onFollowingPress={() => setFollowingModalVisible(true)}
            onGroupsPress={() => handleTabChange("groups")}
          />
          {isOwnProfile ? (
            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              <JoinGroupPanel />
            </View>
          ) : null}
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
                <AppText variant="label" color="destructive">Block user</AppText>
              </TouchableOpacity>
            </View>
          ) : null}
          <ProfileTabs activeTab={activeTab} onTabChange={handleTabChange} />

          {activeTab === "stats" ? (
            isPlayMode ? (
              <PlayStatsView userId={targetUserId} />
            ) : (
              <StatsView stats={stats} bets={bets} />
            )
          ) : activeTab === "groups" ? (
            <UserGroupsSection userId={targetUserId || ""} isOwnProfile={isOwnProfile} />
          ) : getFilteredBets().length === 0 ? (
            <EmptyState icon="ticket-outline" title="No bets found." />
          ) : (
            getFilteredBets().map((bet) => <BetHistoryCard key={bet.id} bet={bet} />)
          )}
        </ScrollView>
      </WebContentColumn>

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

      <AuraScoreModal
        isVisible={isAuraModalVisible}
        onClose={() => setIsAuraModalVisible(false)}
        winRate={stats.winRate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  iconButton: {
    padding: 8,
  },
  accountActions: {
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  accountActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  accountActionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountActionLabel: {
    flex: 1,
    fontWeight: '400',
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
    fontWeight: '400',
  },
});
