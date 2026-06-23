import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { TouchableOpacity, View } from "react-native";

import { ACTIVE_OPACITY } from "@/constants/motion";
import { useTheme } from "@/contexts/ThemeContext";

import { AppText } from "./AppText";

export interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorBanner({ message, onRetry, retryLabel = "Retry" }: ErrorBannerProps) {
  const { theme } = useTheme();

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 12,
        borderRadius: theme.radius.md,
        backgroundColor: "rgba(220, 38, 38, 0.1)",
        borderWidth: 1,
        borderColor: "rgba(220, 38, 38, 0.25)",
      }}
    >
      <Ionicons name="alert-circle" size={20} color={theme.destructive} />
      <AppText variant="bodySm" color="destructive" style={{ flex: 1 }}>
        {message}
      </AppText>
      {onRetry ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          activeOpacity={ACTIVE_OPACITY}
          onPress={onRetry}
        >
          <AppText variant="label" color="destructive">
            {retryLabel}
          </AppText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
