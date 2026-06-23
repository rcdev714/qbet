import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

import { MOTION_CEREMONY } from "@/constants/motion";
import { useTheme } from "@/contexts/ThemeContext";
import { useReduceMotion } from "@/hooks/useReduceMotion";

export interface SuccessPulseProps {
  onComplete?: () => void;
}

export function SuccessPulse({ onComplete }: SuccessPulseProps) {
  const { theme } = useTheme();
  const reduceMotion = useReduceMotion();
  const scale = useRef(new Animated.Value(reduceMotion ? 1 : 0.6)).current;
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      const t = setTimeout(() => onComplete?.(), 200);
      return () => clearTimeout(t);
    }

    Animated.sequence([
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1,
          duration: MOTION_CEREMONY * 0.6,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: MOTION_CEREMONY * 0.4,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(200),
    ]).start(() => onComplete?.());
  }, [onComplete, opacity, reduceMotion, scale]);

  return (
    <Animated.View style={{ opacity, transform: [{ scale }], alignItems: "center" }}>
      <Ionicons name="checkmark-circle" size={64} color={theme.success} />
    </Animated.View>
  );
}
