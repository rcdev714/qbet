import React from "react";
import { View } from "react-native";

import { STAGGER_ITEM_MS } from "@/constants/motion";

import { AppReveal } from "./AppReveal";

export interface StaggerGroupProps {
  children: React.ReactNode;
  baseDelayMs?: number;
  itemDelayMs?: number;
}

export function StaggerGroup({
  children,
  baseDelayMs = 0,
  itemDelayMs = STAGGER_ITEM_MS,
}: StaggerGroupProps) {
  const items = React.Children.toArray(children);

  return (
    <View style={{ gap: 0 }}>
      {items.map((child, index) => (
        <AppReveal key={index} delayMs={baseDelayMs + index * itemDelayMs}>
          {child}
        </AppReveal>
      ))}
    </View>
  );
}
