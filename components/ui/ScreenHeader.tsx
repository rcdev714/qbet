import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HEADER_HEIGHT } from "@/constants/layout";
import { ACTIVE_OPACITY } from "@/constants/motion";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/ui/cn";

import { AppText } from "./AppText";

export interface ScreenHeaderProps {
  title?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
  ignoreTopInset?: boolean;
}

export function ScreenHeader({
  title,
  left,
  right,
  showBack = false,
  onBack,
  ignoreTopInset = false,
}: ScreenHeaderProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    router.back();
  };

  const leftSlot =
    left ??
    (showBack ? (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Go back"
        activeOpacity={ACTIVE_OPACITY}
        onPress={handleBack}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="chevron-back" size={24} color={theme.text} />
      </TouchableOpacity>
    ) : (
      <View style={{ width: 24 }} />
    ));

  return (
    <View
      style={cn({
        minHeight: HEADER_HEIGHT,
        paddingTop: ignoreTopInset ? 0 : insets.top,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: theme.borderSubtle,
        backgroundColor: theme.surface,
      })}
    >
      <View style={{ width: 44, alignItems: "flex-start" }}>{leftSlot}</View>
      <View style={{ flex: 1, alignItems: "center" }}>
        {title ? (
          <AppText variant="title3" numberOfLines={1}>
            {title}
          </AppText>
        ) : null}
      </View>
      <View style={{ width: 44, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}
