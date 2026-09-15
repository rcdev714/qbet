import { AppButton, AppInput, AppListRow, AppText } from "@/components/ui";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { groupService } from "@/services/group.service";

interface GroupInfoModalProps {
  visible: boolean;
  onClose: () => void;
  group: any;
  memberCount: number;
  isAdmin: boolean;
  onEditImage?: () => void;
  onEditName?: () => void;
  onEditDescription?: () => void;
  onInvite?: () => void;
  onLeave?: () => void;
  onDelete?: () => void;
  shareCode?: string | null;
}

export function GroupInfoModal({
  visible,
  onClose,
  group,
  memberCount,
  isAdmin,
  onEditImage,
  onEditName,
  onEditDescription,
  onInvite,
  onLeave,
  onDelete,
  shareCode,
}: GroupInfoModalProps) {
  const { theme } = useTheme();
  const [inviteEmail, setInviteEmail] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);

  const handleEmailInvite = async () => {
    if (!group?.id || !inviteEmail.trim()) return;
    setSendingInvite(true);
    const { ok, error } = await groupService.sendGroupInviteByEmail(group.id, inviteEmail.trim());
    setSendingInvite(false);
    if (!ok) {
      Alert.alert("Could not send invite", error?.message ?? "Try again.");
      return;
    }
    Alert.alert("Invite sent", `We emailed ${inviteEmail.trim()} an invite link.`);
    setInviteEmail("");
  };

  if (!group) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.surface }]}>
        <SafeAreaView style={styles.safeArea}>
          <ModalHeader title="Group Info" onClose={onClose} closeLabel="Done" />

          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.groupHeader}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={isAdmin ? "Change group photo" : undefined}
                onPress={onEditImage}
                disabled={!isAdmin}
                activeOpacity={isAdmin ? 0.7 : 1}
                style={styles.avatarWrap}
              >
                {group.avatar_url ? (
                  <Image
                    source={{ uri: group.avatar_url }}
                    style={[styles.avatar, { borderRadius: theme.radius.pill }]}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.avatar,
                      {
                        backgroundColor: theme.primarySoft,
                        borderRadius: theme.radius.pill,
                        alignItems: "center",
                        justifyContent: "center",
                      },
                    ]}
                  >
                    <AppText variant="display" color="primary">
                      {group.name?.[0]?.toUpperCase() || "G"}
                    </AppText>
                  </View>
                )}
                {isAdmin ? (
                  <View
                    style={[
                      styles.editBadge,
                      {
                        backgroundColor: theme.primary,
                        borderRadius: theme.radius.pill,
                        borderColor: theme.onPrimary,
                      },
                    ]}
                  >
                    <Ionicons name="camera" size={12} color={theme.onPrimary} />
                  </View>
                ) : null}
              </TouchableOpacity>

              <TouchableOpacity
                accessibilityRole="button"
                onPress={onEditName}
                disabled={!isAdmin}
                style={styles.titleRow}
              >
                <AppText variant="title1">{group.name}</AppText>
                {isAdmin ? (
                  <Ionicons name="pencil" size={16} color={theme.textSecondary} style={styles.editIcon} />
                ) : null}
              </TouchableOpacity>

              <AppText variant="body" color="secondary">
                {memberCount} {memberCount === 1 ? "Member" : "Members"}
              </AppText>
            </View>

            <View
              style={[
                styles.section,
                { backgroundColor: theme.input, borderRadius: theme.radius.lg },
              ]}
            >
              <View style={styles.sectionHeader}>
                <AppText variant="label" color="secondary">
                  Description
                </AppText>
                {isAdmin ? (
                  <AppButton
                    title="Edit"
                    variant="ghost"
                    size="sm"
                    onPress={onEditDescription}
                    style={styles.editButton}
                  />
                ) : null}
              </View>
              <AppText variant="body">
                {group.description || "No description provided."}
              </AppText>

              {shareCode ? (
                <View
                  style={[
                    styles.inviteCodeBox,
                    {
                      backgroundColor: theme.surface,
                      borderRadius: theme.radius.sm,
                    },
                  ]}
                >
                  <AppText variant="caption" color="secondary">
                    Invite code
                  </AppText>
                  <Pressable accessibilityRole="button" onPress={onInvite}>
                    <AppText variant="mono" color="primary" style={styles.inviteCode}>
                      {shareCode}
                    </AppText>
                  </Pressable>
                </View>
              ) : null}

              {isAdmin ? (
                <View style={styles.emailInviteSection}>
                  <AppText variant="caption" color="secondary" style={styles.emailInviteLabel}>
                    Invite by email
                  </AppText>
                  <View style={styles.emailInviteRow}>
                    <View style={styles.emailInputWrap}>
                      <AppInput
                        placeholder="friend@email.com"
                        value={inviteEmail}
                        onChangeText={setInviteEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                    </View>
                    <AppButton
                      title="Send"
                      size="sm"
                      loading={sendingInvite}
                      onPress={handleEmailInvite}
                      disabled={!inviteEmail.trim()}
                    />
                  </View>
                </View>
              ) : null}
            </View>

            <View
              style={[
                styles.section,
                styles.actionsSection,
                { backgroundColor: theme.input, borderRadius: theme.radius.lg },
              ]}
            >
              <AppListRow
                title="Invite Members"
                leading={<Ionicons name="share-outline" size={20} color={theme.primary} />}
                onPress={onInvite}
              />
              {isAdmin ? (
                <AppListRow
                  title="Delete Group"
                  leading={<Ionicons name="trash-outline" size={20} color={theme.error} />}
                  onPress={onDelete}
                />
              ) : (
                <AppListRow
                  title="Leave Group"
                  leading={<Ionicons name="log-out-outline" size={20} color={theme.error} />}
                  onPress={onLeave}
                />
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  groupHeader: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatarWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  editBadge: {
    position: "absolute",
    bottom: 16,
    right: 0,
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  editIcon: {
    marginLeft: 8,
  },
  section: {
    padding: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  editButton: {
    minHeight: 32,
    paddingHorizontal: 0,
  },
  inviteCodeBox: {
    marginTop: 16,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  inviteCode: {
    letterSpacing: 2,
  },
  emailInviteSection: {
    marginTop: 16,
    gap: 8,
  },
  emailInviteLabel: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emailInviteRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  emailInputWrap: {
    flex: 1,
  },
  actionsSection: {
    padding: 0,
    overflow: "hidden",
  },
});
