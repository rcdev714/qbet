import React from "react";
import { StyleSheet, View, type ViewProps } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";

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
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderRadius: theme.radius.lg,
        },
        padded && { padding: theme.spacing.lg },
        elevated && styles.elevated,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  elevated: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
});
