import { Brand, Marketing } from '@/constants/theme';
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { LANDING_SECTIONS, SPRING_SNAPPY } from './landing-constants';
import { useLandingScroll } from './LandingScrollContext';

type Props = {
  onNavigate: (sectionId: string, offset: number) => void;
};

export function LandingProgressNav({ onNavigate }: Props) {
  const { scrollY, viewportHeight, sectionOffsets, activeSection } = useLandingScroll();

  const progressStyle = useAnimatedStyle(() => {
    const vh = viewportHeight.value || 800;
    const maxScroll = Math.max(vh * (LANDING_SECTIONS.length - 0.35), 1);
    const progress = interpolate(scrollY.value, [0, maxScroll], [0, 1], Extrapolation.CLAMP);
    return {
      transform: [{ scaleX: progress }],
    };
  });

  const navBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80, 160], [0, 0.7, 1], Extrapolation.CLAMP),
    borderBottomColor: `rgba(255,255,255,${interpolate(scrollY.value, [0, 200], [0, 0.08], Extrapolation.CLAMP)})`,
  }));

  return (
    <>
      <View style={styles.progressTrack} pointerEvents="none">
        <Animated.View style={[styles.progressFill, progressStyle]} />
      </View>

      <Animated.View style={[styles.sideRail, navBgStyle]}>
        {LANDING_SECTIONS.map((section) => (
          <SectionDot
            key={section.id}
            sectionId={section.id}
            label={section.label}
            onPress={() => {
              const offset = sectionOffsets.value[section.id] ?? 0;
              onNavigate(section.id, offset);
            }}
            activeSection={activeSection}
          />
        ))}
      </Animated.View>
    </>
  );
}

function SectionDot({
  sectionId,
  label,
  onPress,
  activeSection,
}: {
  sectionId: string;
  label: string;
  onPress: () => void;
  activeSection: SharedValue<string>;
}) {
  const isActive = useDerivedValue(() => activeSection.value === sectionId);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(isActive.value ? 1.35 : 1, SPRING_SNAPPY) }],
    backgroundColor: isActive.value ? Brand.primary : 'rgba(148, 163, 184, 0.45)',
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: withSpring(isActive.value ? 1 : 0, SPRING_SNAPPY),
    transform: [{ translateX: withSpring(isActive.value ? 0 : -6, SPRING_SNAPPY) }],
  }));

  return (
    <Pressable
      onPress={onPress}
      style={[styles.dotRow, Platform.OS === 'web' && ({ cursor: 'pointer' } as object)]}
      accessibilityRole="button"
      accessibilityLabel={`Go to ${label}`}
    >
      <Animated.View style={[styles.dot, dotStyle]} />
      <Animated.Text style={[styles.dotLabel, labelStyle]}>{label}</Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  progressTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    zIndex: 20,
  },
  progressFill: {
    height: '100%',
    width: '100%',
    backgroundColor: Brand.primary,
    transformOrigin: 'left center',
    ...(Platform.OS === 'web' ? ({ transformOrigin: 'left center' } as object) : {}),
  },
  sideRail: {
    position: 'absolute',
    right: 18,
    top: '38%',
    zIndex: 15,
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(3, 7, 18, 0.55)',
    borderWidth: 1,
    borderColor: Marketing.heroBorder,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        } as object)
      : {}),
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 20,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotLabel: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    position: 'absolute',
    right: 18,
    width: 64,
    textAlign: 'right',
  },
});
