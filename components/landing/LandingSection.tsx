import React from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { useLandingScroll } from './LandingScrollContext';

type Props = {
  id: string;
  children: React.ReactNode;
  /** When true, section fills the viewport (scroll-snap chapter). */
  fullViewport?: boolean;
  /** Last section — stays fully visible, no exit fade. */
  persistVisible?: boolean;
  /** Avoid scale transforms that blur text on web. */
  crispContent?: boolean;
  tint?: 'default' | 'blue' | 'green' | 'violet';
};

const TINTS = {
  default: 'transparent',
  blue: 'rgba(0, 106, 220, 0.04)',
  green: 'rgba(34, 197, 94, 0.035)',
  violet: 'rgba(99, 102, 241, 0.04)',
};

export function LandingSection({
  id,
  children,
  fullViewport = true,
  persistVisible = false,
  crispContent = false,
  tint = 'default',
}: Props) {
  const { height } = useWindowDimensions();
  const { scrollY, viewportHeight, registerSection } = useLandingScroll();
  const sectionOffset = React.useRef(0);

  const handleLayout = (event: LayoutChangeEvent) => {
    sectionOffset.current = event.nativeEvent.layout.y;
    registerSection(id, event.nativeEvent.layout.y);
  };

  const contentStyle = useAnimatedStyle(() => {
    const vh = viewportHeight.value || height;
    const start = sectionOffset.current - vh * 0.35;
    const end = sectionOffset.current + vh * 0.15;
    const progress = interpolate(scrollY.value, [start, end], [0, 1], Extrapolation.CLAMP);

    let opacity = interpolate(progress, [0, 0.35, 1], [0, 0.85, 1], Extrapolation.CLAMP);
    let translateY = interpolate(progress, [0, 1], [56, 0], Extrapolation.CLAMP);
    let scale = crispContent ? 1 : interpolate(progress, [0, 1], [0.96, 1], Extrapolation.CLAMP);

    if (!persistVisible) {
      const exitStart = sectionOffset.current + vh * 0.55;
      const exitEnd = sectionOffset.current + vh * 1.05;
      const exit = interpolate(scrollY.value, [exitStart, exitEnd], [0, 1], Extrapolation.CLAMP);
      opacity *= 1 - exit * 0.55;
    } else if (progress >= 0.35) {
      opacity = 1;
      translateY = 0;
      scale = 1;
    }

    return {
      opacity,
      transform: crispContent ? [{ translateY }] : [{ translateY }, { scale }],
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    const vh = viewportHeight.value || height;
    const center = sectionOffset.current + vh * 0.35;
    const proximity = interpolate(
      scrollY.value,
      [center - vh * 0.5, center, center + vh * 0.5],
      [0, 1, 0],
      Extrapolation.CLAMP,
    );

    return { opacity: proximity * 0.9 };
  });

  return (
    <View
      onLayout={handleLayout}
      nativeID={`landing-section-${id}`}
      style={[
        styles.section,
        fullViewport && { minHeight: Math.max(height * 0.92, 640) },
        Platform.OS === 'web' && fullViewport && (styles.sectionSnap as object),
      ]}
    >
      <Animated.View style={[styles.tint, { backgroundColor: TINTS[tint] }, glowStyle]} pointerEvents="none" />
      <Animated.View style={[styles.inner, contentStyle]}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    justifyContent: 'center',
    paddingVertical: 48,
    position: 'relative',
  },
  sectionSnap: {
    scrollSnapAlign: 'start',
    scrollSnapStop: 'always',
  } as object,
  tint: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 0,
  },
  inner: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    paddingHorizontal: 28,
    zIndex: 1,
  },
});
