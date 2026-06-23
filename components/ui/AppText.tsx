import React from "react";
import { Text, type TextProps } from "react-native";

import {
    getTextStyle,
    type TextColorRole,
    type TextVariant,
} from "@/constants/typography";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/ui/cn";

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: TextColorRole;
}

function resolveColor(role: TextColorRole, theme: ReturnType<typeof useTheme>["theme"]): string {
  switch (role) {
    case "secondary":
      return theme.textSecondary;
    case "muted":
      return theme.mutedForeground;
    case "primary":
      return theme.primary;
    case "destructive":
      return theme.destructive;
    case "success":
      return theme.success;
    case "onPrimary":
      return theme.onPrimary;
    default:
      return theme.text;
  }
}

export function AppText({
  variant = "body",
  color = "default",
  style,
  children,
  ...props
}: AppTextProps) {
  const { theme } = useTheme();

  return (
    <Text
      {...props}
      style={cn(getTextStyle(variant), { color: resolveColor(color, theme) }, style)}
    >
      {children}
    </Text>
  );
}
