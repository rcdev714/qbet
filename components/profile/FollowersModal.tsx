import { ModalHeader } from "@/components/ui/ModalHeader";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { useAuthContext } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { socialService } from "../../services/social.service";

interface Follower {
  id: string;
  username: string;
  avatar_url: string;
  created_at: string;
}

interface FollowersModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
}

export function FollowersModal({ visible, onClose, userId }: FollowersModalProps) {
  const { theme } = useTheme();
  const { user: currentUser } = useAuthContext();
  const router = useRouter();
  
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  const loadFollowers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await socialService.getFollowers(userId);
      setFollowers(data);
      
      // Check follow status for each follower if we are logged in
      if (currentUser) {
        const statuses: Record<string, boolean> = {};
        await Promise.all(
          data.map(async (follower) => {
            if (follower.id === currentUser.id) return;
            const isFollowing = await socialService.getFollowStatus(currentUser.id, follower.id);
            statuses[follower.id] = isFollowing;
          })
        );
        setFollowingMap(statuses);
      }
    } catch (error) {
      console.error("Failed to load followers", error);
    } finally {
      setLoading(false);
    }
  }, [userId, currentUser]);

  useEffect(() => {
    if (visible && userId) {
      loadFollowers();
    }
  }, [visible, userId, loadFollowers]);

  const handleFollowToggle = async (targetId: string) => {
    if (!currentUser) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Optimistic update
    setFollowingMap(prev => ({
      ...prev,
      [targetId]: !prev[targetId]
    }));

    const { error } = await socialService.toggleFollow(targetId);
    if (error) {
      // Revert if error
      setFollowingMap(prev => ({
        ...prev,
        [targetId]: !prev[targetId]
      }));
      console.error("Error toggling follow", error);
    }
  };

  const handleUserPress = (targetUserId: string) => {
    onClose();
    router.push(`/profile/${targetUserId}`);
  };

  const renderItem = ({ item }: { item: Follower }) => {
    const isMe = currentUser?.id === item.id;
    const isFollowing = followingMap[item.id];

    return (
      <TouchableOpacity 
        style={[styles.userRow, { borderBottomColor: theme.border }]} 
        onPress={() => handleUserPress(item.id)}
      >
        <Image
          source={{ uri: item.avatar_url || 'https://via.placeholder.com/50' }}
          style={styles.avatar}
          contentFit="cover"
        />
        
        <View style={styles.userInfo}>
          <Text style={[styles.username, { color: theme.text }]}>@{item.username}</Text>
          <Text style={[styles.timestamp, { color: theme.textSecondary }]}>
            Followed {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>

        {!isMe && currentUser && (
          <TouchableOpacity
            style={[
              styles.followButton,
              { 
                backgroundColor: isFollowing ? theme.surface : theme.primary,
                borderColor: theme.primary,
                borderWidth: 1
              }
            ]}
            onPress={() => handleFollowToggle(item.id)}
          >
            <Text style={[
              styles.followButtonText, 
              { color: isFollowing ? theme.text : '#fff' }
            ]}>
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SafeAreaView style={{ flex: 1 }}>
          <ModalHeader title="Followers" onClose={onClose} closeLabel="Done" />

          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <FlatList
              data={followers}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              extraData={followingMap}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.centerContainer}>
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    No followers yet.
                  </Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    position: 'relative',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '400',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 12,
  },
  closeButtonText: {
    fontSize: 17,
    fontWeight: '400',
  },
  listContent: {
    padding: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 12,
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 90,
    alignItems: 'center',
  },
  followButtonText: {
    fontSize: 12,
    fontWeight: '400',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 16,
  }
});
