import { Image } from "expo-image";
import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
}

export function ProfileHeader({ 
    user, 
    stats, 
    isOwnProfile = true,
    isFollowing = false,
    onFollow,
    onMessage,
    onAuraPress,
    onShare,
    onFollowersPress
}: ProfileHeaderProps) {
  const { theme, isDark } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.avatarContainer} onPress={onAuraPress}>
          <Image
            source={{ uri: user?.avatar_url || 'https://via.placeholder.com/100' }}
            style={styles.avatar}
            contentFit="cover"
          />
          <View style={[styles.auraBadge, { backgroundColor: theme.primary }]}>
             <Text style={styles.auraText}>100</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.text }]}>{stats.totalBets}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Bets</Text>
          </View>
          <TouchableOpacity style={styles.statItem} onPress={onFollowersPress} activeOpacity={0.7} disabled={!onFollowersPress}>
            <Text style={[styles.statValue, { color: theme.text }]}>{stats.followersCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Followers</Text>
          </TouchableOpacity>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.text }]}>{Math.round(stats.winRate * 100)}%</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Win Rate</Text>
          </View>
        </View>
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
                      { backgroundColor: isFollowing ? theme.card : (isDark ? theme.surface : theme.primary), borderColor: isDark ? theme.primary : theme.border, borderWidth: 1 },
                      Platform.OS === 'web' && { cursor: 'pointer' } as any
                  ]}
                  onPress={onFollow}
              >
                  <Text style={[
                      styles.followButtonText, 
                      { color: isFollowing ? theme.text : (isDark ? theme.primary : '#fff') }
                  ]}>
                      {isFollowing ? "Following" : "Follow"}
                  </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                  style={[styles.messageButton, { backgroundColor: theme.card, borderColor: theme.border }, Platform.OS === 'web' && { cursor: 'pointer' } as any]}
                  onPress={onMessage}
              >
                  <Text style={[styles.messageButtonText, { color: theme.text }]}>Message</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity 
              style={[styles.messageButton, { backgroundColor: theme.card, borderColor: theme.border }, Platform.OS === 'web' && { cursor: 'pointer' } as any]}
              onPress={onShare}
          >
              <Text style={[styles.messageButtonText, { color: theme.text }]}>Share Profile</Text>
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
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
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
    fontWeight: '600',
  },
  statsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginLeft: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 12,
  },
  infoContainer: {
    gap: 12,
  },
  username: {
    fontSize: 18,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  followButton: {
    flex: 2,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  messageButton: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageButtonText: {
    fontSize: 14,
    fontWeight: '600',
  }
});
