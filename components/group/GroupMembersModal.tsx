import { AppButton, AppIconButton, AppInput, AppText } from "@/components/ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/ThemeContext";
import { Image } from "expo-image";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import type { Market } from "@/types/market";

export interface GroupMembersModalProps {
  visible: boolean;
  onClose: () => void;
  group: { id: string; name?: string | null; description?: string | null; avatar_url?: string | null } | null;
  members: any[];
  isAdmin: boolean;
  currentUserId?: string;
  shareCode: string | null;
  editedName: string;
  onEditedNameChange: (text: string) => void;
  editedDescription: string;
  onEditedDescriptionChange: (text: string) => void;
  onUpdateGroupName: () => void;
  onUpdateDescription: () => void;
  onPickGroupImage: () => void;
  isUploadingGroupAvatar: boolean;
  onOpenGroupInfo: () => void;
  openMarkets: Market[];
  closedMarkets: Market[];
  marketsLoading: boolean;
  openExpanded: boolean;
  onOpenExpandedChange: (value: boolean | ((prev: boolean) => boolean)) => void;
  closedExpanded: boolean;
  onClosedExpandedChange: (value: boolean | ((prev: boolean) => boolean)) => void;
  formatClosesAt: (iso: string | null) => string;
  onMarketPress: (marketId: string) => void;
  onPromoteToAdmin: (userId: string) => void;
  onRemoveMember: (userId: string) => void;
  onDeleteGroup: () => void;
}

export function GroupMembersModal({
  visible,
  onClose,
  group,
  members,
  isAdmin,
  currentUserId,
  shareCode,
  editedName,
  onEditedNameChange,
  editedDescription,
  onEditedDescriptionChange,
  onUpdateGroupName,
  onUpdateDescription,
  onPickGroupImage,
  isUploadingGroupAvatar,
  onOpenGroupInfo,
  openMarkets,
  closedMarkets,
  marketsLoading,
  openExpanded,
  onOpenExpandedChange,
  closedExpanded,
  onClosedExpandedChange,
  formatClosesAt,
  onMarketPress,
  onPromoteToAdmin,
  onRemoveMember,
  onDeleteGroup,
}: GroupMembersModalProps) {
  const { theme, isDark } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}
        activeOpacity={1}
        onPress={onClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalKeyboardAvoiding}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.modalContent,
              {
                flex: 1,
                maxHeight: "90%",
                backgroundColor: theme.surface,
                borderColor: theme.border,
                borderTopLeftRadius: theme.radius.xl,
                borderTopRightRadius: theme.radius.xl,
              },
            ]}
          >
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <AppText variant="title3" numberOfLines={1} style={{ flex: 1 }}>
                {group?.name}
              </AppText>
              <AppIconButton
                accessibilityLabel="Group info"
                variant="ghost"
                onPress={onOpenGroupInfo}
                icon={<IconSymbol name="info.circle" size={24} color={theme.primary} />}
              />
              <AppIconButton
                accessibilityLabel="Close"
                variant="ghost"
                onPress={onClose}
                icon={<IconSymbol name="xmark.circle.fill" size={28} color={theme.textSecondary} />}
              />
            </View>

            <FlatList
              ListHeaderComponent={
                <>
                  <View style={styles.modalGroupAvatarContainer}>
                    <TouchableOpacity
                      onPress={onPickGroupImage}
                      disabled={!isAdmin || isUploadingGroupAvatar}
                      accessibilityRole="button"
                      accessibilityLabel="Edit group photo"
                    >
                      {group?.avatar_url ? (
                        <Image
                          source={{ uri: group.avatar_url }}
                          style={[styles.modalGroupAvatar, { borderRadius: theme.radius.pill }]}
                          contentFit="cover"
                        />
                      ) : (
                        <View
                          style={[
                            styles.modalGroupAvatarPlaceholder,
                            { backgroundColor: theme.primarySoft, borderRadius: theme.radius.pill },
                          ]}
                        >
                          <AppText variant="title1" color="primary">
                            {group?.name?.[0]?.toUpperCase() || "G"}
                          </AppText>
                        </View>
                      )}
                      {isUploadingGroupAvatar ? (
                        <View style={[styles.uploadProgressOverlay, { borderRadius: theme.radius.pill }]}>
                          <ActivityIndicator color={theme.onPrimary} />
                        </View>
                      ) : null}
                      {isAdmin && !isUploadingGroupAvatar ? (
                        <View
                          style={[styles.uploadProgressOverlay, { backgroundColor: "transparent", borderRadius: theme.radius.pill }]}
                        >
                          <AppText variant="caption" style={{ color: theme.onPrimary }}>
                            EDIT
                          </AppText>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  </View>

                  {isAdmin ? (
                    <View
                      style={[
                        styles.shareCodeSection,
                        { backgroundColor: isDark ? theme.background : theme.muted, borderRadius: theme.radius.lg },
                      ]}
                    >
                      <AppText variant="label" color="secondary">
                        Invite code (admin only):
                      </AppText>
                      <View
                        style={[
                          styles.shareCodeBox,
                          { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: theme.radius.md },
                        ]}
                      >
                        <AppText variant="mono">{shareCode ?? "…"}</AppText>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.shareCodeSection}>
                      <AppText variant="label" color="secondary">
                        Invite code
                      </AppText>
                      <AppText variant="body" color="secondary">
                        Only admins can view the invite code.
                      </AppText>
                    </View>
                  )}

                  <View style={[styles.descriptionInfoSection, { gap: theme.spacing.sm }]}>
                    <AppText variant="label" color="secondary">
                      Group Name
                    </AppText>
                    {isAdmin ? (
                      <View
                        style={[
                          styles.descriptionEditBox,
                          {
                            backgroundColor: isDark ? theme.background : theme.muted,
                            borderColor: theme.border,
                            borderRadius: theme.radius.md,
                          },
                        ]}
                      >
                        <AppInput value={editedName} onChangeText={onEditedNameChange} placeholder="Group Name" />
                        {editedName !== group?.name ? (
                          <AppButton title="Save" variant="ghost" size="sm" onPress={onUpdateGroupName} />
                        ) : null}
                      </View>
                    ) : (
                      <AppText variant="title2">{group?.name}</AppText>
                    )}

                    <AppText variant="label" color="secondary">
                      Description
                    </AppText>
                    {isAdmin ? (
                      <View
                        style={[
                          styles.descriptionEditBox,
                          {
                            backgroundColor: isDark ? theme.background : theme.muted,
                            borderColor: theme.border,
                            borderRadius: theme.radius.md,
                          },
                        ]}
                      >
                        <AppInput
                          value={editedDescription}
                          onChangeText={onEditedDescriptionChange}
                          placeholder="Add a group description..."
                          multiline
                        />
                        {editedDescription !== group?.description ? (
                          <AppButton title="Save" variant="ghost" size="sm" onPress={onUpdateDescription} />
                        ) : null}
                      </View>
                    ) : (
                      <AppText variant="body" color="secondary">
                        {group?.description || "No description set."}
                      </AppText>
                    )}
                  </View>

                  <View style={[styles.predictionsSection, { gap: theme.spacing.sm }]}>
                    <AppText variant="label" color="secondary">
                      Predictions
                    </AppText>
                    <TouchableOpacity
                      style={[
                        styles.accordionHeader,
                        { backgroundColor: theme.input, borderColor: theme.border, borderRadius: theme.radius.md },
                      ]}
                      onPress={() => onOpenExpandedChange((value) => !value)}
                      activeOpacity={0.8}
                    >
                      <AppText variant="title3">Open</AppText>
                      <View style={styles.accordionRight}>
                        <AppText variant="bodySm" color="primary">
                          {openMarkets.length}
                        </AppText>
                        <AppText variant="bodySm" color="primary">
                          {openExpanded ? "▾" : "▸"}
                        </AppText>
                      </View>
                    </TouchableOpacity>
                    {openExpanded ? (
                      <View style={styles.accordionBody}>
                        {marketsLoading ? (
                          <ActivityIndicator size="small" color={theme.mutedForeground} style={{ marginVertical: 8 }} />
                        ) : openMarkets.length === 0 ? (
                          <AppText variant="bodySm" color="secondary" style={{ textAlign: "center", paddingVertical: 12 }}>
                            No open predictions.
                          </AppText>
                        ) : (
                          openMarkets.map((market) => (
                            <TouchableOpacity
                              key={market.id}
                              style={styles.marketRow}
                              onPress={() => onMarketPress(market.id)}
                              activeOpacity={0.8}
                            >
                              <View style={styles.marketRowLeft}>
                                <AppText variant="body" numberOfLines={2}>
                                  {market.question}
                                </AppText>
                                <AppText variant="caption" color="secondary">
                                  Closes: {formatClosesAt(market.closes_at)}
                                </AppText>
                              </View>
                              <View
                                style={[
                                  styles.marketStatusPill,
                                  { backgroundColor: theme.primarySoft, borderRadius: theme.radius.sm },
                                ]}
                              >
                                <AppText variant="caption" color="primary">
                                  OPEN
                                </AppText>
                              </View>
                            </TouchableOpacity>
                          ))
                        )}
                      </View>
                    ) : null}

                    <TouchableOpacity
                      style={[
                        styles.accordionHeader,
                        {
                          marginTop: 10,
                          backgroundColor: theme.input,
                          borderColor: theme.border,
                          borderRadius: theme.radius.md,
                        },
                      ]}
                      onPress={() => onClosedExpandedChange((value) => !value)}
                      activeOpacity={0.8}
                    >
                      <AppText variant="title3">Closed</AppText>
                      <View style={styles.accordionRight}>
                        <AppText variant="bodySm" color="secondary">
                          {closedMarkets.length}
                        </AppText>
                        <AppText variant="bodySm" color="secondary">
                          {closedExpanded ? "▾" : "▸"}
                        </AppText>
                      </View>
                    </TouchableOpacity>
                    {closedExpanded ? (
                      <View style={styles.accordionBody}>
                        {marketsLoading ? (
                          <ActivityIndicator size="small" color={theme.mutedForeground} style={{ marginVertical: 8 }} />
                        ) : closedMarkets.length === 0 ? (
                          <AppText variant="bodySm" color="secondary" style={{ textAlign: "center", paddingVertical: 12 }}>
                            No closed predictions.
                          </AppText>
                        ) : (
                          closedMarkets.map((market) => (
                            <TouchableOpacity
                              key={market.id}
                              style={styles.marketRow}
                              onPress={() => onMarketPress(market.id)}
                              activeOpacity={0.8}
                            >
                              <View style={styles.marketRowLeft}>
                                <AppText variant="body" numberOfLines={2}>
                                  {market.question}
                                </AppText>
                                <AppText variant="caption" color="secondary">
                                  Closed: {formatClosesAt(market.closes_at)}
                                </AppText>
                              </View>
                              <View
                                style={[
                                  styles.marketStatusPill,
                                  { backgroundColor: theme.muted, borderRadius: theme.radius.sm },
                                ]}
                              >
                                <AppText variant="caption" color="secondary">
                                  CLOSED
                                </AppText>
                              </View>
                            </TouchableOpacity>
                          ))
                        )}
                      </View>
                    ) : null}
                  </View>

                  <AppText variant="label" color="secondary">
                    Members
                  </AppText>
                </>
              }
              ListHeaderComponentStyle={{ paddingBottom: 16 }}
              data={members}
              keyExtractor={(item: { user_id: string }) => item.user_id}
              renderItem={({ item }: { item: any }) => (
                <View style={[styles.memberRow, { borderBottomColor: theme.border }]}>
                  <View style={styles.memberInfo}>
                    <AppText variant="title3">
                      {item.users?.email || item.users?.username || "Anonymous User"}
                      {item.user_id === currentUserId ? " (You)" : ""}
                    </AppText>
                    <AppText variant="bodySm" color="secondary">
                      {item.role.toUpperCase()}
                    </AppText>
                  </View>
                  {isAdmin && item.role !== "admin" ? (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <AppButton title="Make Admin" variant="ghost" size="sm" onPress={() => onPromoteToAdmin(item.user_id)} />
                      <AppButton title="Remove" variant="destructive" size="sm" onPress={() => onRemoveMember(item.user_id)} />
                    </View>
                  ) : null}
                </View>
              )}
              ItemSeparatorComponent={() => (
                <View style={[styles.separator, { backgroundColor: theme.border, marginLeft: 0 }]} />
              )}
              ListFooterComponent={
                isAdmin ? (
                  <View style={[styles.adminDangerZone, { marginTop: 40, paddingBottom: 40 }]}>
                    <AppButton title="Delete Group" variant="destructive" onPress={onDeleteGroup} />
                  </View>
                ) : (
                  <View style={{ height: 40 }} />
                )
              }
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: theme.spacing.lg,
                paddingBottom: Platform.OS === "ios" ? 40 : 20,
              }}
              showsVerticalScrollIndicator={false}
            />
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalKeyboardAvoiding: { justifyContent: "flex-end" },
  modalContent: { borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalGroupAvatarContainer: { alignItems: "center", marginVertical: 20 },
  modalGroupAvatar: { width: 100, height: 100 },
  modalGroupAvatarPlaceholder: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadProgressOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  shareCodeSection: { padding: 20, margin: 20, marginTop: 0, gap: 8 },
  shareCodeBox: { padding: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: "center" },
  descriptionInfoSection: { paddingHorizontal: 20 },
  descriptionEditBox: { padding: 12, borderWidth: StyleSheet.hairlineWidth, gap: 8 },
  predictionsSection: { padding: 20 },
  accordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  accordionRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  accordionBody: { paddingVertical: 8, gap: 8 },
  marketRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  marketRowLeft: { flex: 1, marginRight: 12 },
  marketStatusPill: { paddingHorizontal: 8, paddingVertical: 3, overflow: "hidden" },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberInfo: { flex: 1 },
  separator: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
  adminDangerZone: { marginTop: 32, marginBottom: 40, paddingHorizontal: 20 },
});
