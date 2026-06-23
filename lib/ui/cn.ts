import type { ImageStyle, StyleProp, TextStyle, ViewStyle } from "react-native";

type Style = ViewStyle | TextStyle | ImageStyle;

/** Merge conditional React Native styles (shadcn cn equivalent). */
export function cn<T extends Style>(
  ...styles: (StyleProp<T> | false | null | undefined)[]
): StyleProp<T> {
  return styles.filter(Boolean) as StyleProp<T>;
}
