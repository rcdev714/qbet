import React from "react";
import { View } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/ui/cn";

import { AppText } from "./AppText";

export type AppBadgeVariant =
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "destructive";

export interface AppBadgeProps {
  label: string;
  variant?: AppBadgeVariant;
}

export function AppBadge({ label, variant = "default" }: AppBadgeProps) {
  const { theme } = useTheme();

  const colors = (() => {
    switch (variant) {
      case "success":
        return { bg: "rgba(34, 197, 94, 0.15)", fg: theme.success };
      case "warning":
        return { bg: "rgba(251, 191, 36, 0.15)", fg: theme.warning };
      case "destructive":
        return { bg: "rgba(220, 38, 38, 0.12)", fg: theme.destructive };
      case "secondary":
        return { bg: theme.muted, fg: theme.textSecondary };
      default:
        return { bg: theme.primarySoft, fg: theme.primary };
    }
  })();

  return (
    <View
      style={cn({
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: theme.radius.pill,
        backgroundColor: colors.bg,
      })}
    >
      <AppText variant="label" style={{ color: colors.fg }}>
        {label}
      </AppText>
    </View>
  );
}
