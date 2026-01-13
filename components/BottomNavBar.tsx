import { Image } from "expo-image";
import { Router } from "expo-router";
import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuthContext } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { IconSymbol } from "./ui/icon-symbol";
// Removed RootStackParamList import

interface BottomNavBarProps {
  router?: Router;
  onJoinPress?: () => void;
  onNewPress?: () => void;
}

export function BottomNavBar({ router, onJoinPress }: BottomNavBarProps) {
  const { user } = useAuthContext();
  const { theme } = useTheme();

  // Don't show if not logged in
  if (!user) {
    return null;
  }

  const handleJoin = () => {
    if (onJoinPress) {
      onJoinPress();
    }
  };

  return (
    <>
      <View style={[styles.bottomBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={styles.bottomButton}
          onPress={handleJoin}
        >
          <IconSymbol name="number" size={28} color={theme.text} />
          <Text style={[styles.bottomButtonLabel, { color: theme.textSecondary }]}>Join</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomButton}
          onPress={() => router?.push("/topup" as any)}
        >
          <IconSymbol name="dollarsign" size={28} color={theme.text} />
          <Text style={[styles.bottomButtonLabel, { color: theme.textSecondary }]}>Wallet</Text>
        </TouchableOpacity>

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
             <View style={[styles.bottomAvatarPlaceholder, { backgroundColor: theme.primary }]}>
                 <Text style={styles.bottomAvatarInitials}>
                   {user?.username ? user.username.substring(0, 1).toUpperCase() : "U"}
                 </Text>
             </View>
          )}
          {/* <IconSymbol name="person.fill" size={28} color={theme.text} /> */}
          <Text style={[styles.bottomButtonLabel, { color: theme.textSecondary }]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#C6C6C8",
    paddingTop: 6,
    paddingBottom: Platform.OS === "ios" ? 10 : 0,
    paddingHorizontal: 32,
  },
  bottomButton: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
  },
  bottomButtonIcon: {
    fontSize: 24,
    fontWeight: "300",
    color: "#111B21",
    marginBottom: 4,
  },
  bottomButtonLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#667781",
  },
  bottomAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginBottom: 4,
  },
  bottomAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginBottom: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomAvatarInitials: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
});

