import { DeleteAccountSection } from "@/components/legal/DeleteAccountSection";
import { ResidenceSettingsSection } from "@/components/profile/ResidenceSettingsSection";
import { RulesModal } from "@/components/profile/RulesModal";
import { AppButton, AppInput, AppText, FieldGroup } from "@/components/ui";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  user: any;
  onUpdateUsername: (newUsername: string) => Promise<void>;
  onSignOut: () => void;
  onUpdateAvatar: (asset: ImagePicker.ImagePickerAsset) => Promise<void>;
}

export function SettingsModal({
  visible,
  onClose,
  user,
  onUpdateUsername,
  onSignOut,
  onUpdateAvatar,
}: SettingsModalProps) {
  const { theme, isDark, setMode, mode } = useTheme();
  const [newUsername, setNewUsername] = useState(user?.username || "");
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [isRulesVisible, setIsRulesVisible] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    await onUpdateUsername(newUsername);
    setLoading(false);
    onClose();
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAvatarLoading(true);
        await onUpdateAvatar(result.assets[0]);
        setAvatarLoading(false);
      }
    } catch (error: any) {
      Alert.alert("Error picking image", error.message);
      setAvatarLoading(false);
    }
  };

  return (
    <>
      <Modal animationType="slide" transparent={false} visible={visible} presentationStyle="pageSheet">
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
          <ModalHeader title="Settings" onClose={onClose} closeLabel="Done" />

          <View style={styles.content}>
            <View style={styles.section}>
              <AppText variant="label" color="secondary" style={styles.sectionTitle}>
                Account
              </AppText>

              <View
                style={[
                  styles.avatarRow,
                  { backgroundColor: theme.surface, borderRadius: theme.radius.lg },
                ]}
              >
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Change profile photo"
                  onPress={pickImage}
                  style={styles.avatarContainer}
                >
                  {user?.avatar_url ? (
                    <Image
                      source={{ uri: user.avatar_url }}
                      style={[styles.avatar, { borderRadius: theme.radius.pill }]}
                    />
                  ) : (
                    <View
                      style={[
                        styles.avatarPlaceholder,
                        {
                          backgroundColor: isDark ? theme.surface : theme.primary,
                          borderColor: isDark ? theme.primary : "transparent",
                          borderWidth: isDark ? 2 : 0,
                          borderRadius: theme.radius.pill,
                        },
                      ]}
                    >
                      <AppText variant="title2" color="onPrimary">
                        {user?.username?.substring(0, 2).toUpperCase() || "U"}
                      </AppText>
                    </View>
                  )}
                  <AppText variant="body" color="primary">
                    Change Photo
                  </AppText>
                  {avatarLoading ? (
                    <ActivityIndicator style={StyleSheet.absoluteFill} color={theme.primary} />
                  ) : null}
                </TouchableOpacity>
              </View>

              <FieldGroup>
                <AppInput
                  label="Username"
                  value={newUsername}
                  onChangeText={setNewUsername}
                  placeholder="Username"
                />
                <View
                  style={[
                    styles.infoRow,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      borderRadius: theme.radius.lg,
                    },
                  ]}
                >
                  <AppText variant="body">Email</AppText>
                  <AppText variant="body" color="secondary">
                    {user?.email}
                  </AppText>
                </View>
              </FieldGroup>
            </View>

            <View style={styles.section}>
              <AppText variant="label" color="secondary" style={styles.sectionTitle}>
                Appearance
              </AppText>
              <SegmentedControl
                value={mode}
                segments={[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                  { value: "system", label: "System" },
                ]}
                onChange={setMode}
              />
            </View>

            <ResidenceSettingsSection theme={theme} style={styles.section} />

            <View style={styles.section}>
              <AppText variant="label" color="secondary" style={styles.sectionTitle}>
                About
              </AppText>
              <AppButton
                title="Rules"
                variant="secondary"
                onPress={() => setIsRulesVisible(true)}
              />
            </View>

            <DeleteAccountSection theme={theme} style={styles.section} onDeleted={onSignOut} />

            <AppButton title="Save Changes" loading={loading} onPress={handleSave} />

            <AppButton
              title="Sign Out"
              variant="destructive"
              onPress={onSignOut}
              style={styles.signOutButton}
            />
          </View>
          <RulesModal visible={isRulesVisible} onClose={() => setIsRulesVisible(false)} />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.4,
  },
  avatarRow: {
    alignItems: "center",
    padding: 20,
    marginBottom: 16,
  },
  avatarContainer: {
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 80,
    height: 80,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  signOutButton: {
    marginTop: 4,
  },
});
