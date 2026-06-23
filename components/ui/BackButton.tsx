import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { TouchableOpacity } from "react-native";

import { ACTIVE_OPACITY } from "@/constants/motion";
import { useTheme } from "@/contexts/ThemeContext";

export interface BackButtonProps {
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function BackButton({
  onPress,
  accessibilityLabel = "Go back",
}: BackButtonProps) {
  const { theme } = useTheme();
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    router.back();
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      activeOpacity={ACTIVE_OPACITY}
      onPress={handlePress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="chevron-back" size={24} color={theme.text} />
    </TouchableOpacity>
  );
}
