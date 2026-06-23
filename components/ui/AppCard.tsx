import React from "react";
import { StyleSheet, View, type ViewProps } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/ui/cn";

import { AppText } from "./AppText";

interface AppCardProps extends ViewProps {
  padded?: boolean;
  elevated?: boolean;
}

export function AppCard({
  children,
  padded = true,
  elevated = false,
  style,
  ...props
}: AppCardProps) {
  const { theme } = useTheme();

  return (
    <View
      {...props}
      style={cn(
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderRadius: theme.radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
        },
        padded && { padding: theme.spacing.lg },
        elevated && theme.elevation("sm"),
        style,
      )}
    >
      {children}
    </View>
  );
}

export function CardHeader({ children, style, ...props }: ViewProps) {
  return (
    <View {...props} style={cn({ gap: 4, marginBottom: 12 }, style)}>
      {children}
    </View>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <AppText variant="title2">{children}</AppText>;
}

export function CardDescription({ children }: { children: React.ReactNode }) {
  return (
    <AppText variant="bodySm" color="secondary">
      {children}
    </AppText>
  );
}

export function CardContent({ children, style, ...props }: ViewProps) {
  return (
    <View {...props} style={cn({ gap: 8 }, style)}>
      {children}
    </View>
  );
}

export function CardFooter({ children, style, ...props }: ViewProps) {
  return (
    <View {...props} style={cn({ marginTop: 16, flexDirection: "row", gap: 8 }, style)}>
      {children}
    </View>
  );
}
