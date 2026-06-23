import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HEADER_HEIGHT, resolveGutter } from "@/constants/layout";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/ui/cn";

import { AppText } from "./AppText";
import { BackButton } from "./BackButton";

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
  const { width } = useWindowDimensions();
  const gutter = resolveGutter(width);

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
      <BackButton onPress={handleBack} />
    ) : (
      <View style={{ width: 24 }} />
    ));

  return (
    <View
      style={cn({
        minHeight: HEADER_HEIGHT,
        paddingTop: ignoreTopInset ? 0 : insets.top,
        paddingHorizontal: gutter,
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: StyleSheet.hairlineWidth,
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
      <View style={{ minWidth: 44, maxWidth: 148, alignItems: "flex-end", justifyContent: "center" }}>
        {right ?? <View style={{ width: 24 }} />}
      </View>
    </View>
  );
}
