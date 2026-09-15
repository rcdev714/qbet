import React from "react";
import {
    Platform,
    TextInput,
    View,
    type TextInputProps,
} from "react-native";

import { SECTION_GAP_MD } from "@/constants/layout";
import { ACTIVE_OPACITY } from "@/constants/motion";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/ui/cn";

import { AppText } from "./AppText";

export type AppInputVariant = "default" | "onDark";

export interface AppInputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  variant?: AppInputVariant;
}

export function AppInput({
  label,
  error,
  hint,
  variant = "default",
  style,
  accessibilityLabel,
  testID,
  ...props
}: AppInputProps) {
  const { theme } = useTheme();
  const hasError = Boolean(error);
  const isOnDark = variant === "onDark";

  const inputBorderColor = hasError
    ? theme.destructive
    : isOnDark
      ? "rgba(255, 255, 255, 0.12)"
      : theme.border;
  const inputBackground = isOnDark ? "rgba(255, 255, 255, 0.08)" : theme.input;
  const inputTextColor = isOnDark ? "#F4F8FF" : theme.text;
  const placeholderColor = isOnDark ? "rgba(218, 230, 252, 0.6)" : theme.mutedForeground;

  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <AppText variant="label" color={isOnDark ? "secondary" : "default"} style={isOnDark ? { color: "rgba(238, 244, 255, 0.9)" } : undefined}>
          {label}
        </AppText>
      ) : null}
      <TextInput
        {...props}
        testID={testID}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: props.editable === false }}
        placeholderTextColor={placeholderColor}
        style={cn(
          {
            minHeight: 48,
            borderRadius: theme.radius.sm,
            borderWidth: 1,
            borderColor: inputBorderColor,
            backgroundColor: inputBackground,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            fontSize: 15,
            color: inputTextColor,
          },
          Platform.OS === "web" &&
            ({
              outlineStyle: "none",
            } as object),
          style,
        )}
        {...(Platform.OS === "web" && hasError ? ({ "aria-invalid": true } as object) : {})}
      />
      {error ? (
        <AppText variant="caption" color="destructive" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function FieldGroup({ children }: { children: React.ReactNode }) {
  return <View style={{ gap: SECTION_GAP_MD }}>{children}</View>;
}

export { ACTIVE_OPACITY };
