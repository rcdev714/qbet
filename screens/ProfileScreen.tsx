import { AppText, EmptyState } from "@/components/ui";
import { BackButton } from "@/components/ui/BackButton";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { socialLabel } from "@/lib/social/display-name";
import { showAppAlertRaw } from "@/lib/ui/feedback";
import * as Haptics from "expo-haptics";
import { useGroupNavigation } from "@/hooks/useGroupNavigation";
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
import { ActivityFeed } from "../components/social/ActivityFeed";
import { ActivitySharingToggle } from "../components/social/ActivitySharingToggle";
import { ProfileSectionToggles } from "../components/social/ProfileSectionToggles";
import { SEO } from "../components/SEO";
import { useAuthContext } from "../contexts/AuthContext";
import { useSocialFollow } from "../contexts/SocialFollowContext";
import { useIsDesktopWebNav } from "../contexts/NavigationLayoutContext";
import { useTheme } from "../contexts/ThemeContext";
import { useWalletContext } from "../contexts/WalletContext";
import { isAppAdmin } from "../lib/admin";
import {
  coerceProfileTab,
  hiddenPublicSections,
  includeBetOnProfile,
  kycStatusLabelKey,
  ownerProfileSections,
  profileMoneyVisible,
  resolveProfileSections,
  visibleProfileTabs,
  type ProfileSections,
} from "../lib/social/profile-privacy";
import { complianceService } from "../services/compliance.service";
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
  const { openGroup } = useGroupNavigation();
  const { user: currentUser, refreshUser } = useAuthContext();
  const { onFollowToggled } = useSocialFollow();
  const { theme, isDark } = useTheme();
  const { t: tTabs } = useTranslation('tabs');
  const isDesktopWebNav = useIsDesktopWebNav();
  const { isPlayMode } = useWalletContext();
  const { t } = useTranslation("settings");
  const { t: tSocial } = useTranslation("social");

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
  const [activeTab, setActiveTab] = useState<ProfileTab>("activity");
  const [sections, setSections] = useState<ProfileSections>(() =>
    isOwnProfile ? ownerProfileSections() : hiddenPublicSections(),
  );
  const [sectionsReady, setSectionsReady] = useState(isOwnProfile);
  const [verifiedBadge, setVerifiedBadge] = useState(false);
  const [kycStatus, setKycStatus] = useState<string | null>(null);
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
    if (!isOwnProfile) {
      setSections(hiddenPublicSections());
      setSectionsReady(false);
      setBets([]);
      setVerifiedBadge(false);
      setKycStatus(null);
    }

    if (isOwnProfile && currentUser && !viewedUser) {
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

      const privacyResult = await socialService.getProfilePrivacy(targetUserId);
      const legacyActivityVisible =
        !isOwnProfile && privacyResult.missing
          ? await socialService.isProfileActivityVisible(targetUserId)
          : false;
      const nextSections = resolveProfileSections({
        isOwner: isOwnProfile,
        privacy: privacyResult.privacy,
        missing: privacyResult.missing,
        legacyActivityVisible,
      });
      let nextKyc = isOwnProfile ? privacyResult.privacy?.kycStatus ?? null : null;
      if (isOwnProfile && !nextKyc) {
        const compliance = await complianceService.getProfile(targetUserId);
        nextKyc = compliance?.kyc_status ?? "not_started";
      }
      setSections(nextSections);
      setVerifiedBadge(Boolean(privacyResult.privacy?.verifiedBadge));
      setKycStatus(nextKyc);
      setSectionsReady(true);

      // Bets are fetched only for sections this viewer may see. RLS is the backstop.
      const mayReadBets = nextSections.open_bets || nextSections.results;
      const userBets = mayReadBets
        ? (await betService.getUserBetsWithDetails(targetUserId)).filter((bet) =>
            includeBetOnProfile(bet.markets?.status, nextSections),
          )
        : [];
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
      const showMoney = profileMoneyVisible(nextSections);

      setStats({
        totalBets: serverStats?.total_bets ?? totalBets,
        activeBets: showMoney ? activeBets : 0,
        winRate: serverStats?.win_rate ?? winRate,
        totalWagered: showMoney ? wagered : 0,
        totalWon: showMoney ? won : 0,
        bestWin: showMoney ? best : 0,
        averageBet: showMoney ? averageBet : 0,
        followersCount: followStats.followers,
        followingCount: followStats.following,
        groupsCount,
      });
      
      
    } catch (error) {
      console.error("Error loading profile data:", error);
      if (!isOwnProfile) {
        setSections(hiddenPublicSections());
        setBets([]);
        setVerifiedBadge(false);
        setKycStatus(null);
      }
      setSectionsReady(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [targetUserId, currentUser?.id]);
  // Add currentUser?.id dependency so if we login/out it refreshes

  useEffect(() => {
    if (!sectionsReady) return;
    const visible = visibleProfileTabs(sections);
    const next = coerceProfileTab(activeTab, visible);
    if (next !== activeTab) setActiveTab(next);
  }, [sectionsReady, sections, activeTab]);

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

      const wasFollowing = viewedUser?.is_following ?? false;
      const nextFollowing = !wasFollowing;
      if (viewedUser) {
          setViewedUser({ ...viewedUser, is_following: nextFollowing });
      }
      onFollowToggled(nextFollowing);

      const { isFollowing, error } = await socialService.toggleFollow(targetUserId);
      if (error) {
          showAppAlertRaw("Error", "Could not update follow status");
          if (viewedUser) {
              setViewedUser({ ...viewedUser, is_following: wasFollowing });
          }
          onFollowToggled(wasFollowing);
      } else if (viewedUser) {
          setViewedUser({ ...viewedUser, is_following: isFollowing });
          if (isFollowing !== nextFollowing) {
              onFollowToggled(isFollowing);
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
        openGroup(groupId);
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

  const visibleTabs = visibleProfileTabs(sections);
  const hiddenTabs = (["activity", "stats", "groups", "open", "closed"] as ProfileTab[]).filter(
    (tab) => !visibleTabs.includes(tab),
  );
  const showBetMoney = profileMoneyVisible(sections);

  const renderActiveTab = () => {
    if (!sectionsReady) {
      return <EmptyState icon="hourglass-outline" title={tSocial("loading")} />;
    }
    if (activeTab === "activity") {
      if (!sections.activity_logs || !targetUserId) return null;
      return (
        <ActivityFeed profileUserId={targetUserId} scrollEnabled={false} discoverPlacement="none" />
      );
    }
    if (activeTab === "stats") {
      if (isPlayMode && (isOwnProfile || showBetMoney)) {
        return <PlayStatsView userId={targetUserId} />;
      }
      return <StatsView stats={stats} bets={showBetMoney ? bets : []} />;
    }
    if (activeTab === "groups") {
      return <UserGroupsSection userId={targetUserId || ""} isOwnProfile={isOwnProfile} />;
    }
    if (activeTab === "open" && !sections.open_bets) return null;
    if (activeTab === "closed" && !sections.results) return null;
    if (getFilteredBets().length === 0) {
      return <EmptyState icon="ticket-outline" title="No bets found." />;
    }
    return getFilteredBets().map((bet) => <BetHistoryCard key={bet.id} bet={bet} />);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SEO 
        title={viewedUser ? `${socialLabel({ displayName: viewedUser.display_name, username: viewedUser.username })} on Anymarkt` : "Anymarkt Profile"}
        description={viewedUser ? `See ${socialLabel({ displayName: viewedUser.display_name, username: viewedUser.username })}'s prediction track record on Anymarkt: ${stats.totalBets} predictions with a ${Math.round(stats.winRate * 100)}% win rate.` : "View an Anymarkt profile and prediction track record."}
        image={viewedUser?.avatar_url || undefined}
        imageAlt={viewedUser ? `${socialLabel({ displayName: viewedUser.display_name, username: viewedUser.username })}'s Anymarkt profile` : "Anymarkt profile preview"}
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

          <TouchableOpacity
            testID="profile-kyc-status"
            style={[styles.accountActionRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => router.push("/wallet/verify" as any)}
            accessibilityRole="button"
            accessibilityLabel={t("kycStatusLabel")}
          >
            <View style={[styles.accountActionIcon, { backgroundColor: theme.primarySoft }]}>
              <IconSymbol name="checkmark" size={18} color={theme.primary} />
            </View>
            <AppText variant="body" style={styles.accountActionLabel}>
              {t("kycStatusLabel")}
              {kycStatus ? ` · ${t(kycStatusLabelKey(kycStatus))}` : ""}
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
            user={
              viewedUser
                ? {
                    username: viewedUser.username,
                    display_name: viewedUser.display_name,
                    avatar_url: viewedUser.avatar_url,
                    bio: viewedUser.bio,
                  }
                : null
            }
            verifiedBadge={verifiedBadge}
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
          {isOwnProfile ? (
            <View style={styles.activityToggle}>
              <ActivitySharingToggle />
              <ProfileSectionToggles />
            </View>
          ) : null}
          {sectionsReady ? (
            <ProfileTabs
              activeTab={activeTab}
              onTabChange={handleTabChange}
              hiddenTabs={hiddenTabs}
            />
          ) : null}

          {renderActiveTab()}
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
  activityToggle: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 16,
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
