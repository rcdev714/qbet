import { Image } from "expo-image";
import { Router } from "expo-router";
import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuthContext } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { isAdminEmail } from "../lib/admin";
import { IconSymbol } from "./ui/icon-symbol";
// Removed RootStackParamList import

interface BottomNavBarProps {
  router?: Router;
}

const ICON_SIZE = Platform.OS === 'ios' ? 20 : 22;
const AVATAR_SIZE = Platform.OS === 'ios' ? 20 : 22;

export function BottomNavBar({ router }: BottomNavBarProps) {
  const { user } = useAuthContext();
  const { theme } = useTheme();

  // Don't show if not logged in
  if (!user) {
    return null;
  }

  const isAdmin = isAdminEmail(user?.email);

  return (
    <View style={[styles.bottomBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
      <TouchableOpacity
        style={styles.bottomButton}
        onPress={() => router?.push("/feed" as any)}
      >
        <IconSymbol name="house" size={ICON_SIZE} color={theme.text} weight="medium" />
        <Text style={[styles.bottomButtonLabel, { color: theme.textSecondary }]}>Home</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.bottomButton}
        onPress={() => router?.push("/" as any)}
      >
        <IconSymbol name="message" size={ICON_SIZE} color={theme.text} weight="medium" />
        <Text style={[styles.bottomButtonLabel, { color: theme.textSecondary }]}>Dm&apos;s</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.bottomButton}
        onPress={() => router?.push("/topup" as any)}
      >
        <IconSymbol name="wallet" size={ICON_SIZE} color={theme.text} weight="medium" />
        <Text style={[styles.bottomButtonLabel, { color: theme.textSecondary }]}>Wallet</Text>
      </TouchableOpacity>

      {isAdmin && (
        <TouchableOpacity
          style={styles.bottomButton}
          onPress={() => router?.push("/admin-dashboard" as any)}
        >
          <IconSymbol name="shield" size={ICON_SIZE} color={theme.text} weight="medium" />
          <Text style={[styles.bottomButtonLabel, { color: theme.textSecondary }]}>Admin</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.bottomButton}
        onPress={() => router?.push("/profile" as any)}
      >
        {user?.avatar_url ? (
          <Image
            source={{ uri: user.avatar_url }}
            style={styles.bottomAvatar}
            contentFit="cover"
            transition={200}
          />
        ) : (
           <View style={[styles.bottomAvatarPlaceholder, { backgroundColor: theme.surface, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}>
               <Text style={[styles.bottomAvatarInitials, { color: '#ffffff', fontSize: 11 }]}>
                 {user?.username ? user.username.substring(0, 1).toUpperCase() : "U"}
               </Text>
           </View>
        )}
        <Text style={[styles.bottomButtonLabel, { color: theme.textSecondary }]}>Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 4,
    paddingBottom: Platform.OS === "ios" ? 20 : Platform.OS === "web" ? 24 : 8,
    paddingHorizontal: 12,
  },
  bottomButton: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  addButton: {
    width: 44,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  bottomButtonLabel: {
    fontSize: 10,
    fontWeight: "400",
    marginTop: 2,
  },
  bottomAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  bottomAvatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomAvatarInitials: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
});


