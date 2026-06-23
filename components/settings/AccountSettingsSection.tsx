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
  const [saving, setSaving] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  useEffect(() => {
    setUsername(user?.username ?? "");
  }, [user?.username]);

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

  const saveUsername = async () => {
    if (!user || username.trim() === user.username) return;

    setSaving(true);
    const { error } = await supabase
      .from("users")
      .update({ username: username.trim() })
      .eq("id", user.id);

    setSaving(false);

    if (error) {
      Alert.alert(t("usernameError"), t("usernameTaken"));
      return;
    }

    await refreshUser();
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
              {user?.username?.substring(0, 2).toUpperCase() ?? "U"}
            </Text>
          </View>
        )}
        <Text style={[styles.changePhoto, { color: theme.primary }]}>{t("changePhoto")}</Text>
        {avatarLoading ? <ActivityIndicator style={StyleSheet.absoluteFill} color={theme.primary} /> : null}
      </Pressable>

      <View style={[styles.field, { borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>{t("username")}</Text>
        <TextInput
          style={[styles.input, { color: theme.text }, Platform.OS === "web" && ({ cursor: "text" } as any)]}
          value={username}
          onChangeText={setUsername}
          onBlur={saveUsername}
          placeholder={t("username")}
          autoCapitalize="none"
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
    width: 88,
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
