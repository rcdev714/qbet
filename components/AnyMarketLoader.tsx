import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    AccessibilityInfo,
    Animated,
    Easing,
    Platform,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/contexts/ThemeContext";

type AnyMarketLoaderVariant = "screen" | "overlay" | "inline";

interface AnyMarketLoaderProps {
  message?: string;
  variant?: AnyMarketLoaderVariant;
}

/** Full-screen / inline loop timing (auth, long loads). */
export const ANYMARKET_LOADER_FILL_DURATION_MS = 2000;

/** Premium navigation overlay: one-shot letter fill — short so it finishes with the transition. */
export const ANYMARKET_LOADER_OVERLAY_FILL_MS = 480;

const SCREEN_LOOP_FILL_MS = ANYMARKET_LOADER_FILL_DURATION_MS;

/** Single-line box: animation runs 0 → this height so fill matches the whole cycle. */
const WORDMARK_FONT_SIZE = 56;
const WORDMARK_LINE_HEIGHT = Math.round(WORDMARK_FONT_SIZE * 1.06);

export function AnyMarketLoader({
  message = "Loading",
  variant = "screen",
}: AnyMarketLoaderProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [wordMetrics, setWordMetrics] = useState({ w: 0, h: WORDMARK_LINE_HEIGHT });
  const fill = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener?.("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      fill.setValue(1);
      return;
    }

    if (variant === "overlay") {
      fill.setValue(0);
      const run = Animated.timing(fill, {
        toValue: 1,
        duration: ANYMARKET_LOADER_OVERLAY_FILL_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      });
      run.start();
      return () => {
        run.stop();
        fill.setValue(0);
      };
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fill, {
          toValue: 1,
          duration: SCREEN_LOOP_FILL_MS,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(fill, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      fill.setValue(0);
    };
  }, [fill, reduceMotion, variant]);

  const wordFillHeight = useMemo(
    () =>
      fill.interpolate({
        inputRange: [0, 1],
        outputRange: [0, Math.max(wordMetrics.h, 1)],
      }),
    [fill, wordMetrics.h],
  );

  const wordmarkTextStyle = useMemo(
    () => [
      styles.wordmarkBase,
      {
        fontSize: WORDMARK_FONT_SIZE,
        lineHeight: WORDMARK_LINE_HEIGHT,
      },
    ],
    [],
  );

  const strip = (
    <View
      style={[
        styles.strip,
        {
          paddingVertical: variant === "overlay" ? 28 : 32,
          paddingHorizontal: 32,
          backgroundColor: variant === "overlay" ? theme.surface : "transparent",
          borderRadius: variant === "overlay" ? 16 : 0,
          borderWidth: variant === "overlay" ? StyleSheet.hairlineWidth : 0,
          borderColor: theme.border,
          ...(Platform.OS === "web" && variant === "overlay"
            ? ({
                boxShadow: isDark
                  ? "0 16px 40px rgba(0,0,0,0.5)"
                  : "0 12px 32px rgba(15, 23, 42, 0.12)",
              } as object)
            : {}),
          ...(variant === "overlay" && Platform.OS !== "web"
            ? {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: isDark ? 0.45 : 0.12,
                shadowRadius: 24,
                elevation: 12,
              }
            : {}),
        },
      ]}
    >
      <View style={styles.wordmarkMeasure}>
        <Text
          style={[wordmarkTextStyle, { color: theme.textSecondary }]}
          {...(Platform.OS === "android" ? { includeFontPadding: false } : {})}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setWordMetrics((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
          }}
        >
          AnyMarket
        </Text>
        {wordMetrics.w > 0 ? (
          <View
            pointerEvents="none"
            style={[styles.wordmarkFillLayer, { width: wordMetrics.w, height: wordMetrics.h }]}
          >
            <Animated.View
              style={[
                styles.wordmarkFillClip,
                {
                  height: wordFillHeight,
                },
              ]}
            >
              <Text
                style={[
                  wordmarkTextStyle,
                  styles.wordmarkFillText,
                  {
                    color: theme.primary,
                    width: wordMetrics.w,
                  },
                ]}
                {...(Platform.OS === "android" ? { includeFontPadding: false } : {})}
              >
                AnyMarket
              </Text>
            </Animated.View>
          </View>
        ) : null}
      </View>
      {message && message !== "Loading" ? (
        <Text style={[styles.caption, { color: theme.textSecondary }]} numberOfLines={1}>
          {message}
        </Text>
      ) : null}
    </View>
  );

  if (variant === "overlay") {
    return (
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`${message}. AnyMarket`}
        style={[styles.overlayRoot, { pointerEvents: "box-none" }]}
        pointerEvents="box-none"
      >
        <View pointerEvents="auto" style={[styles.overlayStripWrap, { paddingHorizontal: 24 }]}>
          {strip}
        </View>
      </View>
    );
  }

  if (variant === "inline") {
    return (
      <View accessibilityRole="progressbar" accessibilityLabel={`${message}. AnyMarket`} style={styles.inlineRoot}>
        {strip}
      </View>
    );
  }

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`${message}. AnyMarket`}
      style={[
        styles.screenRoot,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingHorizontal: 24,
        },
      ]}
    >
      {strip}
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    justifyContent: "center",
    alignItems: "center",
    ...(Platform.OS === "web" ? ({ position: "fixed" } as object) : {}),
  },
  overlayStripWrap: {
    width: "100%",
    maxWidth: 720,
    alignItems: "stretch",
  },
  inlineRoot: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  strip: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  wordmarkMeasure: {
    position: "relative",
    alignSelf: "center",
    marginBottom: 8,
  },
  wordmarkBase: {
    fontWeight: "400",
    letterSpacing: -1.4,
    textAlign: "center",
  },
  wordmarkFillLayer: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  wordmarkFillClip: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
  },
  wordmarkFillText: {
    position: "absolute",
    bottom: 0,
    left: 0,
    textAlign: "center",
  },
  caption: {
    marginTop: 16,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    textAlign: "center",
  },
});
