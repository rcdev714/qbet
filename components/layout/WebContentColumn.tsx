import React from "react";
import {
    Platform,
    StyleSheet,
    View,
    useWindowDimensions,
    type ViewProps,
    type ViewStyle,
} from "react-native";

import {
    resolveGutter,
    resolveWebColumnMaxWidth,
    type WebColumnVariant,
} from "@/constants/layout";
import { cn } from "@/lib/ui/cn";

export interface WebContentColumnProps extends ViewProps {
  variant?: WebColumnVariant;
  /** Sticky toolbar row above scrollable children (e.g. category chips) */
  stickyHeader?: React.ReactNode;
  /** When false, native/mobile skips max-width centering */
  webOnly?: boolean;
  children: React.ReactNode;
}

/**
 * Centers content in a responsive max-width column on web.
 * On native, renders a full-width flex container.
 */
export function WebContentColumn({
  variant = "standard",
  stickyHeader,
  webOnly = true,
  children,
  style,
  ...props
}: WebContentColumnProps) {
  const { width } = useWindowDimensions();
  const gutter = resolveGutter(width);
  const maxWidth = resolveWebColumnMaxWidth(variant);
  const applyColumn = !webOnly || Platform.OS === "web";

  const columnStyle = cn<ViewStyle>(
    styles.column,
    applyColumn && {
      maxWidth,
      width: "100%",
      alignSelf: "center",
      paddingHorizontal: gutter,
    },
    style,
  );

  return (
    <View style={styles.root} {...props}>
      {stickyHeader ? (
        <View
          style={[
            styles.stickyHeader,
            applyColumn && {
              maxWidth,
              width: "100%",
              alignSelf: "center",
              paddingHorizontal: gutter,
            },
          ]}
        >
          {stickyHeader}
        </View>
      ) : null}
      <View style={columnStyle}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: "100%",
  },
  column: {
    flex: 1,
    width: "100%",
  },
  stickyHeader: {
    zIndex: 10,
  },
});
