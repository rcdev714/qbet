import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, type ViewStyle } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";

export type AppSkeletonVariant = "text" | "row" | "card";

export interface AppSkeletonProps {
  variant?: AppSkeletonVariant;
  width?: number | `${number}%`;
  height?: number;
  style?: ViewStyle;
}

export function AppSkeleton({
  variant = "text",
  width,
  height,
  style,
}: AppSkeletonProps) {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    let mounted = true;
    let animation: Animated.CompositeAnimation | null = null;

    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!mounted || reduceMotion) {
        opacity.setValue(0.55);
        return;
      }
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.75, duration: 800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        ]),
      );
      animation.start();
    });

    return () => {
      mounted = false;
      animation?.stop();
    };
  }, [opacity]);

  const dimensions = (() => {
    switch (variant) {
      case "row":
        return { width: width ?? "100%", height: height ?? 52, borderRadius: theme.radius.sm };
      case "card":
        return { width: width ?? "100%", height: height ?? 120, borderRadius: theme.radius.lg };
      default:
        return { width: width ?? "70%", height: height ?? 14, borderRadius: theme.radius.sm };
    }
  })();

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[
        {
          backgroundColor: theme.muted,
          opacity,
          ...dimensions,
        },
        style,
      ]}
    />
  );
}
