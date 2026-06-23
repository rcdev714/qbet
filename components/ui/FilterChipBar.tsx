import React from "react";
import { Pressable, ScrollView, StyleSheet, View, ViewStyle } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { useTheme } from "@/contexts/ThemeContext";

export interface FilterChipOption<T extends string = string> {
  key: T;
  label: string;
  accessibilityHint?: string;
}

interface FilterChipBarProps<T extends string> {
  options: FilterChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function FilterChipBar<T extends string>({
  options,
  value,
  onChange,
  style,
  accessibilityLabel,
}: FilterChipBarProps<T>) {
  const { theme } = useTheme();

  return (
    <View
      style={[styles.bar, { borderBottomColor: theme.border }, style]}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {options.map((item) => {
          const active = value === item.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={item.label}
              accessibilityHint={item.accessibilityHint}
              onPress={() => onChange(item.key)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? theme.primarySoft : theme.surface,
                  borderColor: active ? theme.primary : theme.border,
                  borderRadius: theme.radius.pill,
                },
              ]}>
              <AppText
                variant="label"
                color={active ? "primary" : "secondary"}
                style={styles.chipLabel}>
                {item.label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  chipLabel: {},
});
