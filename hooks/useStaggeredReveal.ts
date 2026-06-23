import { useMemo } from "react";
import { type ViewStyle } from "react-native";

import { STAGGER_ITEM_MS, STAGGER_MAX_ITEMS } from "@/constants/motion";

import { useReduceMotion } from "./useReduceMotion";

export interface StaggerRevealConfig {
  baseDelayMs?: number;
  itemDelayMs?: number;
  maxItems?: number;
  translateY?: number;
}

export function useStaggeredReveal(count: number, config: StaggerRevealConfig = {}) {
  const reduceMotion = useReduceMotion();
  const {
    baseDelayMs = 0,
    itemDelayMs = STAGGER_ITEM_MS,
    maxItems = STAGGER_MAX_ITEMS,
    translateY = 12,
  } = config;

  return useMemo(() => {
    const getItemStyle = (index: number): ViewStyle => {
      if (reduceMotion || index >= maxItems) {
        return { opacity: 1, transform: [{ translateY: 0 }] };
      }
      const delay = baseDelayMs + index * itemDelayMs;
      return {
        opacity: 0,
        transform: [{ translateY }],
      };
    };

    return { getItemStyle, reduceMotion };
  }, [baseDelayMs, itemDelayMs, maxItems, reduceMotion, translateY, count]);
}
