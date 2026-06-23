import React from "react";
import { View, type ViewProps } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/ui/cn";

export interface AppDividerProps extends ViewProps {
  inset?: number;
}

export function AppDivider({ inset = 0, style, ...props }: AppDividerProps) {
  const { theme } = useTheme();

  return (
    <View
      {...props}
      style={cn(
        {
          height: 1,
          backgroundColor: theme.borderSubtle,
          marginLeft: inset,
          marginRight: inset,
        },
        style,
      )}
    />
  );
}
