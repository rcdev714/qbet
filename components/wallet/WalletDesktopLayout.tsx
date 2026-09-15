import React from "react";
import { Platform, StyleSheet, View, type ViewProps } from "react-native";

interface WalletDesktopLayoutProps extends ViewProps {
  main: React.ReactNode;
  side: React.ReactNode;
  footer?: React.ReactNode;
  enabled: boolean;
}

export function WalletDesktopLayout({
  main,
  side,
  footer,
  enabled,
  style,
  ...props
}: WalletDesktopLayoutProps) {
  if (!enabled) {
    return (
      <View style={style} {...props}>
        {main}
        {side}
        {footer}
      </View>
    );
  }

  return (
    <View style={[styles.root, style]} {...props}>
      <View style={styles.columns}>
        <View style={styles.main}>{main}</View>
        <View style={styles.side}>{side}</View>
      </View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    gap: 20,
  },
  columns: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 20,
    alignItems: "flex-start",
  },
  main: {
    flex: 58,
    minWidth: 0,
    width: "100%",
  },
  side: {
    flex: 42,
    minWidth: 0,
    width: "100%",
    gap: 14,
  },
  footer: {
    width: "100%",
  },
});
