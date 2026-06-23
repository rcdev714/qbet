import React from "react";
import {
    ScrollView,
    View,
    useWindowDimensions,
    type ScrollViewProps,
    type ViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
    MOBILE_TAB_BAR_HEIGHT,
    SCREEN_PADDING_BOTTOM,
    SCREEN_PADDING_TOP,
    resolveContentMaxWidth,
    resolveGutter,
    type ContentMaxWidth,
} from "@/constants/layout";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/ui/cn";

export interface AppScreenProps extends ViewProps {
  maxWidth?: ContentMaxWidth;
  scroll?: boolean;
  scrollProps?: ScrollViewProps;
  padBottomForTabBar?: boolean;
  children: React.ReactNode;
}

export function AppScreen({
  maxWidth = "full",
  scroll = false,
  scrollProps,
  padBottomForTabBar = false,
  children,
  style,
  ...props
}: AppScreenProps) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const gutter = resolveGutter(width);
  const maxW = resolveContentMaxWidth(maxWidth);

  const paddingBottom =
    SCREEN_PADDING_BOTTOM +
    insets.bottom +
    (padBottomForTabBar ? MOBILE_TAB_BAR_HEIGHT : 0);

  const containerStyle = cn(
    {
      flex: 1,
      backgroundColor: theme.background,
      paddingTop: SCREEN_PADDING_TOP + insets.top,
      paddingBottom,
      paddingHorizontal: gutter,
      maxWidth: maxW,
      width: "100%",
      alignSelf: maxW ? "center" : undefined,
    },
    style,
  );

  if (scroll) {
    return (
      <ScrollView
        {...props}
        {...scrollProps}
        testID={props.testID ?? scrollProps?.testID}
        style={[{ flex: 1, backgroundColor: theme.background }, scrollProps?.style]}
        contentContainerStyle={cn(containerStyle, scrollProps?.contentContainerStyle)}
        keyboardShouldPersistTaps={scrollProps?.keyboardShouldPersistTaps ?? "handled"}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View {...props} style={containerStyle}>
      {children}
    </View>
  );
}
