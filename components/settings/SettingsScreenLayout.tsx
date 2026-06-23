import React from "react";
import { ScrollView, StyleSheet, View, type ScrollViewProps } from "react-native";

import { ScreenHeader, type ScreenHeaderProps } from "@/components/ui/ScreenHeader";
import { useTheme } from "@/contexts/ThemeContext";

interface SettingsScreenLayoutProps extends ScreenHeaderProps {
  children: React.ReactNode;
  scrollProps?: ScrollViewProps;
}

export function SettingsScreenLayout({
  children,
  scrollProps,
  ...headerProps
}: SettingsScreenLayoutProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader {...headerProps} />
      <ScrollView
        {...scrollProps}
        contentContainerStyle={[
          styles.content,
          scrollProps?.contentContainerStyle,
        ]}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
});
