import { decode } from "base64-arraybuffer";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { useAuthContext } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { DISPLAY_NAME_MAX, socialLabel, USERNAME_MAX } from "@/lib/social/display-name";
import { isMissingRpcError } from "@/lib/social/feed-visibility";
import { supabase } from "@/lib/supabase";

type ThemeColors = {
  text: string;
  textSecondary: string;
  surface: string;
  border: string;
  primary: string;
  onPrimary: string;
  background: string;
};

interface AccountSettingsSectionProps {
  theme: ThemeColors;
}

export function AccountSettingsSection({ theme }: AccountSettingsSectionProps) {
  const { user, refreshUser } = useAuthContext();
  const { isDark } = useTheme();
  const { t } = useTranslation("settings");
  const [username, setUsername] = useState(user?.username ?? "");
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [saving, setSaving] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  useEffect(() => {
    setUsername(user?.username ?? "");
    setDisplayName(user?.display_name ?? "");
  }, [user?.username, user?.display_name]);

  const pickImage = async () => {
    if (!user) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]?.base64) return;

      setAvatarLoading(true);
      const asset = result.assets[0];
      const arrayBuffer = decode(asset.base64!);
      const ext = asset.uri.substring(asset.uri.lastIndexOf(".") + 1);
      const fileName = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, arrayBuffer, {
          contentType: asset.mimeType ?? "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(fileName);

      const { error } = await supabase
        .from("users")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (error) throw error;
      await refreshUser();
    } catch (error) {
      Alert.alert(t("avatarError"), error instanceof Error ? error.message : t("avatarError"));
    } finally {
      setAvatarLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    const nextUsername = username.trim();
    const nextDisplayName = displayName.trim();
    const usernameChanged = nextUsername !== (user.username ?? "");
    const displayChanged = nextDisplayName !== (user.display_name ?? "");
    if (!usernameChanged && !displayChanged) return;

    setSaving(true);
    const { error } = await (supabase as any).rpc("update_own_profile", {
      p_username: nextUsername,
      p_display_name: nextDisplayName,
      p_bio: user.bio ?? "",
      p_avatar_url: user.avatar_url ?? "",
    });

    if (!error) {
      setSaving(false);
      await refreshUser();
      return;
    }

    if (isMissingRpcError(error) && usernameChanged) {
      const direct = await supabase
        .from("users")
        .update({ username: nextUsername })
        .eq("id", user.id);
      setSaving(false);
      if (direct.error) {
        Alert.alert(t("usernameError"), t("usernameTaken"));
        return;
      }
      await refreshUser();
      if (displayChanged) {
        Alert.alert(t("displayNameError"), t("displayNameUnavailable"));
      }
      return;
    }

    setSaving(false);
    const taken = /already taken|23505|duplicate/i.test(error.message ?? "");
    Alert.alert(
      taken ? t("usernameError") : t("displayNameError"),
      taken ? t("usernameTaken") : (error.message ?? t("displayNameError")),
    );
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={pickImage}
        style={[styles.avatarRow, { backgroundColor: theme.background }]}
        accessibilityRole="button"
        accessibilityLabel={t("changePhoto")}>
        {user?.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View
            style={[
              styles.avatarPlaceholder,
              {
                backgroundColor: isDark ? theme.surface : theme.primary,
                borderColor: isDark ? theme.primary : "transparent",
              },
            ]}>
            <Text style={styles.avatarInitial}>
              {socialLabel({
                displayName: displayName || user?.display_name,
                username: username || user?.username,
              }).substring(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={[styles.changePhoto, { color: theme.primary }]}>{t("changePhoto")}</Text>
        {avatarLoading ? <ActivityIndicator style={StyleSheet.absoluteFill} color={theme.primary} /> : null}
      </Pressable>

      <View>
        <View style={[styles.field, { borderColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>{t("displayName")}</Text>
          <TextInput
            style={[styles.input, { color: theme.text }, Platform.OS === "web" && ({ cursor: "text" } as any)]}
            value={displayName}
            onChangeText={setDisplayName}
            onBlur={() => void saveProfile()}
            placeholder={t("displayName")}
            autoCapitalize="words"
            maxLength={DISPLAY_NAME_MAX}
            accessibilityLabel={t("displayName")}
          />
        </View>
        <Text style={[styles.helper, { color: theme.textSecondary }]}>{t("displayNameHelper")}</Text>
      </View>

      <View style={[styles.field, { borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>{t("username")}</Text>
        <TextInput
          style={[styles.input, { color: theme.text }, Platform.OS === "web" && ({ cursor: "text" } as any)]}
          value={username}
          onChangeText={setUsername}
          onBlur={() => void saveProfile()}
          placeholder={t("username")}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={USERNAME_MAX}
          accessibilityLabel={t("username")}
        />
      </View>

      <View style={[styles.field, { borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>{t("email")}</Text>
        <Text style={[styles.readOnly, { color: theme.text }]} numberOfLines={1}>
          {user?.email ?? t("notAvailable")}
        </Text>
      </View>

      {saving ? (
        <ActivityIndicator color={theme.primary} style={styles.saving} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  avatarRow: {
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 8,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  avatarInitial: {
    color: "#fff",
    fontSize: 22,
    fontWeight: '400',
  },
  changePhoto: {
    fontSize: 14,
    fontWeight: '400',
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    maxWidth: 128,
    flexShrink: 1,
  },
  helper: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    textAlign: "right",
  },
  readOnly: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    textAlign: "right",
  },
  saving: {
    alignSelf: "center",
  },
});
