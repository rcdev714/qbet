import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { useTheme } from "@/contexts/ThemeContext";

export function GroupsDetailPlaceholder() {
  const { theme } = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.background }]}
      testID="groups-detail-placeholder"
    >
      <View style={[styles.iconWrap, { backgroundColor: theme.input, borderRadius: theme.radius.pill }]}>
        <Ionicons name="chatbubbles-outline" size={40} color={theme.mutedForeground} />
      </View>
      <AppText variant="title2" style={styles.title}>
        Select a group
      </AppText>
      <AppText variant="bodySm" color="secondary" style={styles.subtitle}>
        Choose a group from the list to view chat, active markets, and rankings.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  iconWrap: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    maxWidth: 320,
  },
});
