import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { View } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";

import { AppButton } from "./AppButton";
import { AppText } from "./AppText";

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  variant?: "default" | "destructive";
}

export function EmptyState({
  icon = "folder-open-outline",
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  variant = "default",
}: EmptyStateProps) {
  const { theme } = useTheme();
  const iconColor = variant === "destructive" ? theme.destructive : theme.mutedForeground;

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        gap: 12,
      }}
      accessibilityRole="text"
    >
      <Ionicons name={icon} size={40} color={iconColor} />
      <AppText variant="title2" style={{ textAlign: "center" }}>
        {title}
      </AppText>
      {description ? (
        <AppText variant="bodySm" color="secondary" style={{ textAlign: "center" }}>
          {description}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <AppButton
          title={actionLabel}
          variant={variant === "destructive" ? "destructive" : "primary"}
          onPress={onAction}
          style={{ marginTop: 8, minWidth: 160 }}
        />
      ) : null}
      {secondaryActionLabel && onSecondaryAction ? (
        <AppButton
          title={secondaryActionLabel}
          variant="secondary"
          onPress={onSecondaryAction}
          style={{ minWidth: 160 }}
        />
      ) : null}
    </View>
  );
}
