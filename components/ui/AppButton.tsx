import React from "react";
import {
    ActivityIndicator,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    type TouchableOpacityProps,
} from "react-native";

import { useTheme } from "@/contexts/ThemeContext";

type AppButtonVariant = "primary" | "secondary" | "ghost";

interface AppButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: AppButtonVariant;
  loading?: boolean;
}

export function AppButton({
  title,
  variant = "primary",
  loading = false,
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
  const focusRing =
    Platform.OS === "web" && isFocused && !isDisabled
      ? ({ boxShadow: `0 0 0 3px ${theme.primarySoft}` } as any)
      : null;

  return (
    <TouchableOpacity
      {...props}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole={accessibilityRole ?? "button"}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      activeOpacity={0.85}
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
          backgroundColor: isPrimary
            ? theme.primary
            : isSecondary
              ? theme.primarySoft
              : "transparent",
          borderColor: isPrimary ? theme.primary : theme.border,
        },
        variant !== "ghost" && styles.withBorder,
        isDisabled && styles.disabled,
        Platform.OS === "web" &&
          ({
            cursor: isDisabled ? "default" : "pointer",
            touchAction: "manipulation",
          } as any),
        focusRing,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={isPrimary ? theme.onPrimary : theme.primary} /> : null}
      <Text
        style={[
          styles.label,
          { color: isPrimary ? theme.onPrimary : theme.primary },
        ]}
      >
        {loading ? `${title}…` : title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  withBorder: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
});
