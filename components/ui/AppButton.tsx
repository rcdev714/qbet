import React from "react";
import {
    ActivityIndicator,
    Platform,
    StyleSheet,
    TouchableOpacity,
    View,
    type TouchableOpacityProps,
} from "react-native";

import { ACTIVE_OPACITY, DISABLED_OPACITY } from "@/constants/motion";
import { useTheme } from "@/contexts/ThemeContext";

import { AppText } from "./AppText";

type AppButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type AppButtonSize = "xs" | "sm" | "md" | "lg";

interface AppButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

const SIZE_STYLES: Record<AppButtonSize, { minHeight: number; px: number }> = {
  xs: { minHeight: 34, px: 10 },
  sm: { minHeight: 36, px: 12 },
  md: { minHeight: 44, px: 16 },
  lg: { minHeight: 56, px: 20 },
};

export function AppButton({
  title,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  disabled,
  accessibilityLabel,
  accessibilityRole,
  onBlur,
  onFocus,
  style,
  ...props
}: AppButtonProps) {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = React.useState(false);
  const isDisabled = disabled || loading;
  const isPrimary = variant === "primary";
  const isSecondary = variant === "secondary";
  const isDestructive = variant === "destructive";
  const sizeStyle = SIZE_STYLES[size];

  const focusRing =
    Platform.OS === "web" && isFocused && !isDisabled
      ? ({ boxShadow: `0 0 0 3px ${theme.ring}` } as object)
      : null;

  const backgroundColor = isPrimary
    ? theme.primary
    : isDestructive
      ? theme.destructive
      : isSecondary
        ? theme.surface
        : "transparent";

  const labelColor = isPrimary || isDestructive ? theme.onPrimary : isSecondary ? theme.text : theme.primary;

  return (
    <TouchableOpacity
      {...props}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole={accessibilityRole ?? "button"}
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
        styles.button,
        {
          borderRadius: theme.radius.md,
          backgroundColor,
          borderColor: isPrimary
            ? theme.primary
            : isDestructive
              ? theme.destructive
              : theme.border,
          minHeight: sizeStyle.minHeight,
          paddingHorizontal: sizeStyle.px,
          opacity: isDisabled ? DISABLED_OPACITY : 1,
        },
        variant !== "ghost" && styles.withBorder,
        Platform.OS === "web" &&
          ({
            cursor: isDisabled ? "default" : "pointer",
            touchAction: "manipulation",
          } as object),
        focusRing,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <>
          {icon ? <View style={styles.iconSlot}>{icon}</View> : null}
          <AppText
            variant={size === "xs" || size === "sm" ? "label" : "body"}
            style={{ color: labelColor }}
          >
            {title}
          </AppText>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  withBorder: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconSlot: {
    alignItems: "center",
    justifyContent: "center",
  },
});
