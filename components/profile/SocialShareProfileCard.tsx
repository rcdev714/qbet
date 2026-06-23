import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

interface SocialShareProfileCardProps {
  user: {
    username?: string | null;
    avatar_url?: string | null;
  } | null;
  stats: {
    totalBets: number;
    followersCount?: number;
    winRate: number;
    totalWagered: number;
    totalWon: number;
  };
  onClose?: () => void;
  onShare?: () => void;
}

const { width: windowWidth } = Dimensions.get('window');
const CARD_WIDTH = Math.min(windowWidth * 0.9, 400);
const CARD_HEIGHT = CARD_WIDTH * 1.6; // Immersive aspect ratio

export function SocialShareProfileCard({ 
    user, 
    stats,
    onClose,
    onShare
}: SocialShareProfileCardProps) {
  const { theme, isDark } = useTheme();

  return (
    <View style={styles.overlay}>
      <View style={[styles.card, { backgroundColor: isDark ? '#000' : '#fff' }]}>
        {/* Immersive Background */}
        <View style={styles.imageContainer}>
          {user?.avatar_url ? (
            <Image
              source={{ uri: user.avatar_url }}
              style={styles.backgroundImage}
              contentFit="cover"
              blurRadius={50}
            />
          ) : (
             <LinearGradient
               colors={[theme.primary, '#000']}
               style={styles.backgroundImage}
             />
          )}
          
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)', '#000']}
            style={styles.gradient}
          />

          {/* User Info Overlay */}
          <View style={styles.userOverlay}>
            <View style={styles.avatarBorder}>
                <Image
                  source={{ uri: user?.avatar_url || '/assets/images/icon.png' }}
                  style={styles.avatar}
                  contentFit="cover"
                />
            </View>
            <Text style={styles.username}>@{user?.username || "prediction_master"}</Text>
            <View style={styles.badge}>
                <Text style={styles.badgeText}>ELITE PREDICTOR</Text>
            </View>
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.statsSection}>
            <View style={styles.statRow}>
                <View style={styles.statBox}>
                    <Text style={styles.statTitle}>WINS</Text>
                    <Text style={styles.statValue}>{Math.round(stats.winRate * 100)}%</Text>
                </View>
                <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)' }]}>
                    <Text style={styles.statTitle}>FOLLOWERS</Text>
                    <Text style={styles.statValue}>{stats.followersCount || 0}</Text>
                </View>
            </View>

            <View style={styles.pnlContainer}>
                 <Text style={styles.pnlLabel}>TOTAL PROFIT</Text>
                 <Text style={[styles.pnlValue, { color: stats.totalWon >= stats.totalWagered ? '#2ECC71' : '#FF453A' }]}>
                    {stats.totalWon >= stats.totalWagered ? '+' : ''}${Math.abs(stats.totalWon - stats.totalWagered).toLocaleString()}
                 </Text>
            </View>
        </View>

        {/* Call to Action */}
        <TouchableOpacity style={[styles.ctaButton, { backgroundColor: theme.primary }]} onPress={onShare}>
            <Text style={styles.ctaText}>SHARE PROFILE</Text>
        </TouchableOpacity>

        {onClose && (
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  imageContainer: {
    flex: 2,
    position: 'relative',
    width: '100%',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  userOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  avatarBorder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#fff',
    padding: 3,
    marginBottom: 12,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
  },
  username: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '400',
    marginBottom: 6,
  },
  badge: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1,
  },
  statsSection: {
    flex: 1,
    padding: 24,
    backgroundColor: '#000',
  },
  statRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '400',
    marginBottom: 4,
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '400',
  },
  pnlContainer: {
    alignItems: 'center',
    paddingTop: 10,
  },
  pnlLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '400',
    marginBottom: 4,
  },
  pnlValue: {
    fontSize: 32,
    fontWeight: '400',
  },
  ctaButton: {
    margin: 20,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  closeText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '300',
  }
});
