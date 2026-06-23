import React, { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

import { MOTION_NORMAL } from "@/constants/motion";

import { useReduceMotion } from "@/hooks/useReduceMotion";

export interface AppRevealProps {
  children: React.ReactNode;
  delayMs?: number;
  durationMs?: number;
}

export function AppReveal({ children, delayMs = 0, durationMs = MOTION_NORMAL }: AppRevealProps) {
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reduceMotion ? 0 : 12)).current;

  useEffect(() => {
    if (reduceMotion) return;

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: durationMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: durationMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }, delayMs);

    return () => clearTimeout(timer);
  }, [delayMs, durationMs, opacity, reduceMotion, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>
  );
}
