import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Pressable,
    SafeAreaView,
    StyleSheet,
    View,
} from "react-native";

import { DiscoverPeopleList } from "@/components/social/DiscoverPeopleList";
import { UserAvatar } from "@/components/social/UserAvatar";
import { AppButton } from "@/components/ui/AppButton";
import { AppText } from "@/components/ui/AppText";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { useAuthContext } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { socialHandle, socialLabel } from "../../lib/social/display-name";
import { socialService } from "../../services/social.service";

interface FollowingUser {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url: string;
  followed_at: string;
}

interface FollowingModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
}

function OwnProfileEmptyFollowing({
  onDiscover,
  onFollowChange,
}: {
  onDiscover: () => void;
  onFollowChange: () => void;
}) {
  const { t } = useTranslation("social");
  const router = useRouter();

  return (
    <View style={styles.emptyOwnWrap}>
      <AppText variant="bodySm" color="secondary" style={styles.emptyTitle}>
        {t("followingEmpty")}
      </AppText>
      <DiscoverPeopleList
        embedded
        scrollEnabled
        showHeader={false}
        onFollowChange={onFollowChange}
      />
      <AppButton
        title={t("followingEmptyAction")}
        variant="secondary"
        size="sm"
        onPress={() => {
          onDiscover();
          router.push("/discover" as any);
        }}
        style={styles.emptyAction}
      />
    </View>
  );
}

export function FollowingModal({ visible, onClose, userId }: FollowingModalProps) {
  const { theme } = useTheme();
  const { user: currentUser } = useAuthContext();
  const router = useRouter();
  const { t } = useTranslation("social");

  const [following, setFollowing] = useState<FollowingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const isOwnProfile = currentUser?.id === userId;

  const load = useCallback(async () => {
    setLoading(true);
    const data = await socialService.getFollowing(userId);
    setFollowing(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (visible && userId) load();
  }, [visible, userId, load]);

  const handleUserPress = (targetUserId: string) => {
    onClose();
    router.push(`/profile/${targetUserId}`);
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
          <ModalHeader title={t("followingTitle")} onClose={onClose} closeLabel={t("close")} />

          {loading ? (
            <View style={styles.center} accessibilityLabel={t("loading")}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : following.length === 0 && isOwnProfile ? (
            <OwnProfileEmptyFollowing onDiscover={onClose} onFollowChange={load} />
          ) : (
            <FlatList
              data={following}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <EmptyState
                  icon="people-outline"
                  title={t("followingEmpty")}
                />
              }
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.userRow, { borderBottomColor: theme.border }]}
                  onPress={() => handleUserPress(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t("viewProfile", { username: socialLabel({ displayName: item.display_name, username: item.username }) })}
                >
                  <UserAvatar
                    uri={item.avatar_url}
                    username={socialLabel({ displayName: item.display_name, username: item.username })}
                    size={50}
                  />
                  <View style={styles.userInfo}>
                    <AppText variant="body" style={styles.username}>
                      {socialLabel({ displayName: item.display_name, username: item.username })}
                    </AppText>
                    {socialHandle(item.username) &&
                    socialLabel({ displayName: item.display_name, username: item.username }) !== item.username?.trim() ? (
                      <AppText variant="caption" color="secondary">{socialHandle(item.username)}</AppText>
                    ) : null}
                    <AppText variant="caption" color="secondary">
                      {t("followingSince", {
                        date: new Date(item.followed_at).toLocaleDateString(),
                      })}
                    </AppText>
                  </View>
                </Pressable>
              )}
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: 16, flexGrow: 1 },
  emptyOwnWrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  emptyTitle: { lineHeight: 20 },
  emptyAction: { alignSelf: "center", marginBottom: 16 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  userInfo: { flex: 1 },
  username: { fontWeight: '400', marginBottom: 2 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 40 },
});
