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

export interface AppInputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
}

export function AppInput({
  label,
  error,
  hint,
  style,
  accessibilityLabel,
  testID,
  ...props
}: AppInputProps) {
  const { theme } = useTheme();
  const hasError = Boolean(error);

  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <AppText variant="label" color="default">
          {label}
        </AppText>
      ) : null}
      <TextInput
        {...props}
        testID={testID}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: props.editable === false }}
        placeholderTextColor={theme.mutedForeground}
        style={cn(
          {
            minHeight: 48,
            borderRadius: theme.radius.sm,
            borderWidth: 1,
            borderColor: hasError ? theme.destructive : theme.border,
            backgroundColor: theme.input,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            fontSize: 15,
            color: theme.text,
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
