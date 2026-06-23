import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { TouchableOpacity, View } from "react-native";

import { ACTIVE_OPACITY } from "@/constants/motion";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/ui/cn";

import { AppText } from "./AppText";

const MIN_ROW_HEIGHT = 52;

export interface AppListRowProps {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

export function AppListRow({
  title,
  subtitle,
  leading,
  trailing,
  chevron = false,
  onPress,
  accessibilityLabel,
  testID,
}: AppListRowProps) {
  const { theme } = useTheme();

  const content = (
    <View
      style={cn({
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
        minHeight: MIN_ROW_HEIGHT,
        paddingVertical: theme.spacing.sm,
      })}
    >
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="body" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="bodySm" color="secondary" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing}
      {chevron ? (
        <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      activeOpacity={ACTIVE_OPACITY}
      onPress={onPress}
    >
      {content}
    </TouchableOpacity>
  );
}
