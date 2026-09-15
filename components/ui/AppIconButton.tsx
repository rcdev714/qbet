import React from "react";
import {
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  View,
  type TouchableOpacityProps,
} from "react-native";

import { ACTIVE_OPACITY, DISABLED_OPACITY } from "@/constants/motion";
import { useTheme } from "@/contexts/ThemeContext";

const ICON_BUTTON_SIZE = 44;

export interface AppIconButtonProps extends Omit<TouchableOpacityProps, "children"> {
  icon: React.ReactNode;
  accessibilityLabel: string;
  loading?: boolean;
  variant?: "default" | "ghost" | "onDark";
}

export function AppIconButton({
  icon,
  accessibilityLabel,
  loading = false,
  variant = "default",
  disabled,
  onBlur,
  onFocus,
  style,
  ...props
}: AppIconButtonProps) {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = React.useState(false);
  const isDisabled = disabled || loading;

  const focusRing =
    Platform.OS === "web" && isFocused && !isDisabled
      ? ({ boxShadow: `0 0 0 3px ${theme.ring}` } as object)
      : null;

  const backgroundColor =
    variant === "ghost"
      ? "transparent"
      : variant === "onDark"
        ? "rgba(255, 255, 255, 0.08)"
        : theme.surface;

  const borderColor =
    variant === "onDark" ? "rgba(255, 255, 255, 0.12)" : theme.border;

  return (
    <TouchableOpacity
      {...props}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      activeOpacity={ACTIVE_OPACITY}
      onBlur={(event) => {
        setIsFocused(false);
        onBlur?.(event);
      }}
      onFocus={(event) => {
        setIsFocused(true);
        onFocus?.(event);
      }}
      style={[
        {
          width: ICON_BUTTON_SIZE,
          height: ICON_BUTTON_SIZE,
          borderRadius: theme.radius.md,
          backgroundColor,
          borderWidth: variant === "ghost" ? 0 : 1,
          borderColor,
          alignItems: "center",
          justifyContent: "center",
          opacity: isDisabled ? DISABLED_OPACITY : 1,
        },
        Platform.OS === "web" &&
          ({
            cursor: isDisabled ? "default" : "pointer",
            touchAction: "manipulation",
          } as object),
        focusRing,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={theme.primary} size="small" /> : <View>{icon}</View>}
    </TouchableOpacity>
  );
}
