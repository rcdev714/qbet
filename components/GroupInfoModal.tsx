import { ModalHeader } from "@/components/ui/ModalHeader";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useState } from "react";
import {
    Alert,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { groupService } from "../services/group.service";

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
  shareCode
}: GroupInfoModalProps) {
  const { theme, isDark } = useTheme();
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
        <SafeAreaView style={{ flex: 1 }}>
          <ModalHeader title="Group Info" onClose={onClose} closeLabel="Done" />

          <ScrollView contentContainerStyle={styles.content}>
            {/* Header Section */}
            <View style={styles.groupHeader}>
              <TouchableOpacity onPress={onEditImage} disabled={!isAdmin} activeOpacity={isAdmin ? 0.7 : 1} style={{ alignItems: 'center', justifyContent: 'center' }}>
                {group.avatar_url ? (
                  <Image
                    source={{ uri: group.avatar_url }}
                    style={styles.avatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: theme.primary + "20", alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 40, fontWeight: '400', color: theme.primary }}>
                      {group.name?.[0]?.toUpperCase() || "G"}
                    </Text>
                  </View>
                )}
                {isAdmin && (
                  <View style={[styles.editBadge, { backgroundColor: theme.primary }]}>
                    <Ionicons name="camera" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity onPress={onEditName} disabled={!isAdmin} style={styles.titleRow}>
                 <Text style={[styles.groupName, { color: theme.text }]}>{group.name}</Text>
                 {isAdmin && <Ionicons name="pencil" size={16} color={theme.textSecondary} style={{marginLeft: 8}} />}
              </TouchableOpacity>
              
              <Text style={[styles.memberCount, { color: theme.textSecondary }]}>
                {memberCount} {memberCount === 1 ? "Member" : "Members"}
              </Text>
            </View>

            {/* Description Section */}
            <View style={[styles.section, { backgroundColor: theme.input }]}>
               <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>DESCRIPTION</Text>
                  {isAdmin && (
                      <TouchableOpacity onPress={onEditDescription}>
                          <Text style={[styles.editLink, { color: theme.primary }]}>Edit</Text>
                      </TouchableOpacity>
                  )}
               </View>
              <Text style={[styles.description, { color: theme.text }]}>
                {group.description || "No description provided."}
              </Text>
              {shareCode && (
                  <View style={{ marginTop: 16, padding: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#fff', borderRadius: 8, alignItems: 'center' }}>
                      <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 4 }}>INVITE CODE</Text>
                      <TouchableOpacity onPress={onInvite}>
                          <Text style={{ color: theme.primary, fontSize: 20, fontWeight: '400', letterSpacing: 2 }}>{shareCode}</Text>
                      </TouchableOpacity>
                  </View>
              )}
              {isAdmin ? (
                <View style={{ marginTop: 16 }}>
                  <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 8 }}>INVITE BY EMAIL</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      style={{
                        flex: 1,
                        borderWidth: 1,
                        borderColor: theme.border,
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        color: theme.text,
                        backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#fff",
                        ...(Platform.OS === "web" ? { outlineStyle: "none" } as any : {}),
                      }}
                      placeholder="friend@email.com"
                      placeholderTextColor={theme.textSecondary}
                      value={inviteEmail}
                      onChangeText={setInviteEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      onPress={handleEmailInvite}
                      disabled={sendingInvite}
                      style={{
                        backgroundColor: theme.primary,
                        borderRadius: 8,
                        paddingHorizontal: 14,
                        justifyContent: "center",
                      }}>
                      <Text style={{ color: "#fff", fontWeight: '400' }}>
                        {sendingInvite ? "..." : "Send"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>

            {/* Actions Section */}
            <View style={[styles.section, { backgroundColor: theme.input, padding: 0, overflow: 'hidden' }]}>
                <TouchableOpacity style={[styles.actionRow, { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]} onPress={onInvite}>
                    <View style={styles.actionIcon}>
                        <Ionicons name="share-outline" size={20} color={theme.primary} />
                    </View>
                    <Text style={[styles.actionText, { color: theme.primary }]}>Invite Members</Text>
                </TouchableOpacity>

                 {/* Leave / Delete */}
                 {isAdmin ? (
                    <TouchableOpacity style={styles.actionRow} onPress={onDelete}>
                        <View style={styles.actionIcon}>
                            <Ionicons name="trash-outline" size={20} color={theme.error} />
                        </View>
                        <Text style={[styles.actionText, { color: theme.error }]}>Delete Group</Text>
                    </TouchableOpacity>
                 ) : (
                    <TouchableOpacity style={styles.actionRow} onPress={onLeave}>
                        <View style={styles.actionIcon}>
                            <Ionicons name="log-out-outline" size={20} color={theme.error} />
                        </View>
                        <Text style={[styles.actionText, { color: theme.error }]}>Leave Group</Text>
                    </TouchableOpacity>
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
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  groupHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  editBadge: {
    position: 'absolute',
    bottom: 16,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
  },
  groupName: {
    fontSize: 22,
    fontWeight: '400',
    textAlign: 'center',
  },
  memberCount: {
    fontSize: 15,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '400',
    opacity: 0.6,
  },
  editLink: {
      fontSize: 14,
      fontWeight: '400',
  },
  description: {
    fontSize: 16,
    lineHeight: 22,
  },
  actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
  },
  actionIcon: {
      marginRight: 12,
  },
  actionText: {
      fontSize: 16,
      fontWeight: '400',
  },
});
