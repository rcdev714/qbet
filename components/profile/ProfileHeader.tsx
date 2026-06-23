import { Image } from "expo-image";
import React from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

interface ProfileHeaderProps {
  user: {
    username?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  } | null;
  stats: {
    totalBets: number;
    followersCount: number;
    followingCount?: number;
    groupsCount?: number;
    activeBets: number;
    winRate: number;
  };
  isOwnProfile?: boolean;
  isFollowing?: boolean;
  onFollow?: () => void;
  onMessage?: () => void;
  onAuraPress: () => void;
  onShare: () => void;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
  onGroupsPress?: () => void;
}

type StatKey = "bets" | "followers" | "following" | "groups" | "winRate";

export function ProfileHeader({ 
    user, 
    stats, 
    isOwnProfile = true,
    isFollowing = false,
    onFollow,
    onMessage,
    onAuraPress,
    onShare,
    onFollowersPress,
    onFollowingPress,
    onGroupsPress
}: ProfileHeaderProps) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation("social");

  const statItems: {
    key: StatKey;
    value: string;
    label: string;
    onPress?: () => void;
    a11yLabel: string;
  }[] = [
    {
      key: "bets",
      value: String(stats.totalBets),
      label: t("statBets"),
      a11yLabel: t("statBetsA11y", { count: stats.totalBets }),
    },
    {
      key: "followers",
      value: String(stats.followersCount),
      label: t("statFollowers"),
      onPress: onFollowersPress,
      a11yLabel: t("statFollowersA11y", { count: stats.followersCount }),
    },
    {
      key: "following",
      value: String(stats.followingCount ?? 0),
      label: t("statFollowing"),
      onPress: onFollowingPress,
      a11yLabel: t("statFollowingA11y", { count: stats.followingCount ?? 0 }),
    },
    {
      key: "groups",
      value: String(stats.groupsCount ?? 0),
      label: t("statGroups"),
      onPress: onGroupsPress,
      a11yLabel: t("statGroupsA11y", { count: stats.groupsCount ?? 0 }),
    },
    {
      key: "winRate",
      value: `${Math.round(stats.winRate * 100)}%`,
      label: t("statWinRate"),
      a11yLabel: t("statWinRateA11y", { percent: Math.round(stats.winRate * 100) }),
    },
  ];

  const isWeb = Platform.OS === "web";

  const headerStatItems = statItems.filter((item) => !(isWeb && item.key === "winRate"));

  const statsContent = headerStatItems.map((item) => {
    const Wrapper = item.onPress ? TouchableOpacity : View;
    return (
      <Wrapper
        key={item.key}
        style={[styles.statPill, isWeb && styles.statPillWeb, { borderColor: theme.border }]}
        {...(item.onPress
          ? {
              onPress: item.onPress,
              activeOpacity: 0.7,
              disabled: !item.onPress,
              accessibilityRole: "button" as const,
              accessibilityLabel: item.a11yLabel,
            }
          : { accessibilityLabel: item.a11yLabel })}
      >
        <Text style={[styles.statValue, { color: theme.text }]}>{item.value}</Text>
        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{item.label}</Text>
      </Wrapper>
    );
  });

  return (
    <View style={[styles.container, isWeb && styles.containerWeb]}>
      <View style={[styles.topRow, isWeb && styles.topRowWeb]}>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={onAuraPress}
          accessibilityRole="button"
          accessibilityLabel={t("openAura")}>
          <Image
            source={{ uri: user?.avatar_url || 'https://via.placeholder.com/100' }}
            style={[styles.avatar, isWeb && styles.avatarWeb]}
            contentFit="cover"
          />
          {!isWeb ? (
          <View style={[styles.auraBadge, { backgroundColor: theme.primary }]}>
             <Text style={styles.auraText}>100</Text>
          </View>
          ) : null}
        </TouchableOpacity>

        {isWeb ? (
          <View style={styles.statsRowWeb}>{statsContent}</View>
        ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statsScroll}
          contentContainerStyle={styles.statsRow}
          accessibilityRole="none">
          {statsContent}
        </ScrollView>
        )}
      </View>

      <View style={styles.infoContainer}>
        <Text style={[styles.username, { color: theme.text }]}>
          {user?.username || "Anonymous"}
        </Text>
        
        <View style={styles.actionButtons}>
          {!isOwnProfile && (
            <>
              <TouchableOpacity 
                  style={[
                      styles.followButton, 
                      {
                        backgroundColor: isFollowing
                          ? theme.input
                          : isDark
                            ? theme.surface
                            : theme.primary,
                        borderColor: isFollowing ? theme.border : isDark ? theme.primary : theme.primary,
                        borderWidth: 1,
                      },
                      Platform.OS === 'web' && { cursor: 'pointer' } as any
                  ]}
                  onPress={onFollow}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isFollowing
                      ? t("unfollowUser", { username: user?.username ?? "" })
                      : t("followUser", { username: user?.username ?? "" })
                  }
              >
                  <Text style={[
                      styles.followButtonText, 
                      {
                        color: isFollowing
                          ? theme.text
                          : isDark
                            ? theme.primary
                            : theme.onPrimary,
                      },
                  ]}>
                      {isFollowing ? t("following") : t("follow")}
                  </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                  style={[styles.messageButton, { backgroundColor: theme.card, borderColor: theme.border }, Platform.OS === 'web' && { cursor: 'pointer' } as any]}
                  onPress={onMessage}
                  accessibilityRole="button"
                  accessibilityLabel={t("messageUser", { username: user?.username ?? "" })}
              >
                  <Text style={[styles.messageButtonText, { color: theme.text }]}>{t("message")}</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity 
              style={[styles.messageButton, { backgroundColor: theme.card, borderColor: theme.border }, Platform.OS === 'web' && { cursor: 'pointer' } as any]}
              onPress={onShare}
              accessibilityRole="button"
              accessibilityLabel={t("shareProfile")}
          >
              <Text style={[styles.messageButtonText, { color: theme.text }]}>{t("shareProfile")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 10,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  containerWeb: {
    paddingHorizontal: 0,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  topRowWeb: {
    alignItems: "flex-start",
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#333',
  },
  avatarWeb: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  auraBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000',
  },
  auraText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '400',
  },
  statsScroll: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  statsRowWeb: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 8,
  },
  statPill: {
    minWidth: 64,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statPillWeb: {
    minWidth: 0,
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    minHeight: 0,
    alignItems: 'flex-start',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '400',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  infoContainer: {
    gap: 12,
  },
  username: {
    fontSize: 18,
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  followButton: {
    flex: 2,
    minHeight: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '400',
  },
  messageButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageButtonText: {
    fontSize: 14,
    fontWeight: '400',
  }
});
