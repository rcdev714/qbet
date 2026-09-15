import { Marketing } from '@/constants/theme';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

type Pointer = { x: number; y: number };

type Props = {
  scrollY?: SharedValue<number>;
};

export function LandingBackground({ scrollY }: Props) {
  const pointer = React.useRef<Pointer>({ x: 0, y: 0 });
  const [, setTick] = React.useState(0);
  const drift = useSharedValue(0);

  React.useEffect(() => {
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [drift]);

  const orbOneStyle = useAnimatedStyle(() => {
    const parallax = scrollY
      ? interpolate(scrollY.value, [0, 1200], [0, -120], Extrapolation.CLAMP)
      : 0;
    return {
      transform: [
        { translateX: drift.value * 28 - 14 },
        { translateY: drift.value * -18 + 9 + parallax * 0.35 },
      ],
    };
  });

  const orbTwoStyle = useAnimatedStyle(() => {
    const parallax = scrollY
      ? interpolate(scrollY.value, [0, 1200], [0, 80], Extrapolation.CLAMP)
      : 0;
    return {
      transform: [
        { translateX: (1 - drift.value) * -22 + 11 },
        { translateY: drift.value * 24 - 12 + parallax * 0.2 },
      ],
    };
  });

  const gridStyle = useAnimatedStyle(() => {
    if (!scrollY) return {};
    const shift = interpolate(scrollY.value, [0, 2000], [0, -96], Extrapolation.CLAMP);
    return { transform: [{ translateY: shift }] };
  });

  const handlePointerMove = React.useCallback((event: { nativeEvent: { locationX: number; locationY: number } }) => {
    pointer.current = {
      x: event.nativeEvent.locationX,
      y: event.nativeEvent.locationY,
    };
    setTick((value) => value + 1);
  }, []);

  const spotlightStyle = React.useMemo(
    () => ({
      left: pointer.current.x - 220,
      top: pointer.current.y - 220,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pointer updates via setTick
    [pointer.current.x, pointer.current.y],
  );

  return (
    <View
      style={styles.root}
      {...(Platform.OS === 'web'
        ? ({
            onPointerMove: handlePointerMove,
          } as any)
        : {})}
    >
      <View style={styles.base} />
      <Animated.View style={[styles.grid, gridStyle]} pointerEvents="none" />
      <Animated.View style={[styles.orb, styles.orbOne, orbOneStyle]} pointerEvents="none" />
      <Animated.View style={[styles.orb, styles.orbTwo, orbTwoStyle]} pointerEvents="none" />
      {Platform.OS === 'web' ? (
        <View style={[styles.spotlight, spotlightStyle]} pointerEvents="none" />
      ) : null}
      <View style={styles.vignette} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: Marketing.heroBackground,
  },
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Marketing.heroBackground,
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.45,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        } as any)
      : {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(255, 255, 255, 0.04)',
        }),
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbOne: {
    width: 520,
    height: 520,
    top: -180,
    right: -120,
    backgroundColor: 'rgba(0, 106, 220, 0.14)',
  },
  orbTwo: {
    width: 440,
    height: 440,
    bottom: -160,
    left: -100,
    backgroundColor: 'rgba(34, 197, 94, 0.07)',
  },
  spotlight: {
    position: 'absolute',
    width: 440,
    height: 440,
    borderRadius: 220,
    backgroundColor: 'rgba(0, 106, 220, 0.08)',
    ...(Platform.OS === 'web'
      ? ({
          transition: 'left 160ms cubic-bezier(0.16, 1, 0.3, 1), top 160ms cubic-bezier(0.16, 1, 0.3, 1)',
        } as any)
      : {}),
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'radial-gradient(ellipse 80% 60% at 50% 40%, transparent 0%, rgba(3, 7, 18, 0.85) 100%)',
        } as any)
      : {
          backgroundColor: 'rgba(3, 7, 18, 0.35)',
        }),
  },
});
