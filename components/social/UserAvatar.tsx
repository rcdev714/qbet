import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";

interface UserAvatarProps {
  uri?: string | null;
  username?: string | null;
  email?: string | null;
  size?: number;
  accessibilityLabel?: string;
}

export function UserAvatar({
  uri,
  username,
  email,
  size = 40,
  accessibilityLabel,
}: UserAvatarProps) {
  const { theme } = useTheme();
  const initial = (username?.trim()?.[0] ?? email?.trim()?.[0] ?? "?").toUpperCase();
  const label = accessibilityLabel ?? (username?.trim() ? username.trim() : "User");
  const hasImage = Boolean(uri?.trim());

  if (hasImage) {
    return (
      <Image
        source={{ uri: uri!.trim() }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        accessibilityLabel={label}
        accessibilityRole="image"
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.primarySoft,
        },
      ]}
      accessibilityLabel={label}
      accessibilityRole="image"
    >
      <Text style={[styles.initial, { color: theme.primary, fontSize: size * 0.4 }]}>
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    fontWeight: '400',
  },
});
