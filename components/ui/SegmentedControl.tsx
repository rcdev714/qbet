import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";

interface Segment<T extends string> {
  value: T;
  label: string;
  description?: string;
  testID?: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  segments: Segment<T>[];
  onChange: (value: T) => void;
  compact?: boolean;
}

export function SegmentedControl<T extends string>({
  value,
  segments,
  onChange,
  compact = false,
}: SegmentedControlProps<T>) {
  const { theme, isDark } = useTheme();
  const [focusedValue, setFocusedValue] = React.useState<T | null>(null);
  const focusRing =
    Platform.OS === "web"
      ? ({ boxShadow: `0 0 0 3px ${theme.primarySoft}` } as any)
      : null;

  return (
    <View
      accessibilityRole="radiogroup"
      style={[
        styles.container,
        {
          backgroundColor: theme.input,
          borderColor: theme.border,
          borderRadius: theme.radius.md,
          padding: theme.spacing.xs,
        },
      ]}
    >
      {segments.map((segment) => {
        const isActive = segment.value === value;
        const isFocused = focusedValue === segment.value;
        return (
          <TouchableOpacity
            key={segment.value}
            testID={segment.testID}
            accessibilityLabel={segment.description ? `${segment.label}, ${segment.description}` : segment.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: isActive }}
            onPress={() => onChange(segment.value)}
            onBlur={() => setFocusedValue(null)}
            onFocus={() => setFocusedValue(segment.value)}
            activeOpacity={0.8}
            style={[
              styles.item,
              compact && styles.itemCompact,
              { borderRadius: theme.radius.sm },
              isActive && {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                borderWidth: StyleSheet.hairlineWidth,
              },
              Platform.OS === "web" && ({ cursor: "pointer", touchAction: "manipulation" } as any),
              isFocused && focusRing,
            ]}
          >
            <Text
              style={[
                styles.label,
                compact && styles.labelCompact,
                { color: isActive ? theme.text : isDark ? "#CBD5E1" : theme.textSecondary },
              ]}
            >
              {segment.label}
            </Text>
            {segment.description && !compact ? (
              <Text
                style={[
                  styles.description,
                  { color: isActive ? theme.textSecondary : theme.textSecondary },
                ]}
                numberOfLines={1}
              >
                {segment.description}
              </Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
    alignItems: "center",
  },
  item: {
    flex: 1,
    minHeight: 44,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  itemCompact: {
    minHeight: 32,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: "400",
  },
  labelCompact: {
    fontSize: 13,
  },
  description: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "400",
  },
});
