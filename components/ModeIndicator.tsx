import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface ModeIndicatorProps {
  isPlayMode: boolean;
  size?: "small" | "medium";
}

export function ModeIndicator({ isPlayMode, size = "small" }: ModeIndicatorProps) {
  const isSmall = size === "small";

  return (
    <View
      style={[
        styles.container,
        isSmall ? styles.containerSmall : styles.containerMedium,
        { backgroundColor: isPlayMode ? "#9B59B6" : "#007AFF" },
      ]}
    >
      <Text style={[styles.emoji, isSmall && styles.emojiSmall]}>
        {isPlayMode ? "🎮" : "💰"}
      </Text>
      <Text style={[styles.text, isSmall && styles.textSmall]}>
        {isPlayMode ? "PLAY" : "LIVE"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    gap: 4,
  },
  containerSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  containerMedium: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  emoji: {
    fontSize: 12,
  },
  emojiSmall: {
    fontSize: 10,
  },
  text: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  textSmall: {
    fontSize: 9,
  },
});
