import { Brand, Marketing } from '@/constants/theme';
import React from 'react';
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { SPRING_SNAPPY } from './landing-constants';

export type LandingMarket = {
  group: string;
  question: string;
  closeTime: string;
  volume: string;
  options: { label: string; chance: number }[];
};

type Props = {
  markets: LandingMarket[];
  activeIndex: number;
  onSelectIndex: (index: number) => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const WEB_CRISP_TEXT = Platform.OS === 'web'
  ? ({
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
      textRendering: 'optimizeLegibility',
    } as object)
  : {};

function AnimatedMeter({ chance }: { chance: number }) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withSpring(chance, SPRING_SNAPPY);
  }, [chance, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value / 100 }],
  }));

  return (
    <View style={styles.meterTrack}>
      <Animated.View style={[styles.meterFill, fillStyle]} />
    </View>
  );
}

function MarketCard({ market }: { market: LandingMarket }) {
  const lead = market.options[0];

  return (
    <Animated.View entering={FadeIn.duration(280).easing(Easing.out(Easing.cubic))} exiting={FadeOut.duration(160)}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={[styles.liveText, WEB_CRISP_TEXT]}>LIVE</Text>
          </View>
          <Text style={[styles.groupLabel, WEB_CRISP_TEXT]}>{market.group}</Text>
        </View>
        <Text style={[styles.question, WEB_CRISP_TEXT]}>{market.question}</Text>
        <View style={styles.meterBlock}>
          <View style={styles.meterRow}>
            <Text style={[styles.meterLabel, WEB_CRISP_TEXT]}>{lead.label}</Text>
            <Text style={[styles.meterValue, WEB_CRISP_TEXT]}>{lead.chance}%</Text>
          </View>
          <AnimatedMeter chance={lead.chance} />
        </View>
        <View style={styles.optionsPreview}>
          {market.options.slice(1).map((option) => (
            <View key={option.label} style={styles.optionChip}>
              <Text style={[styles.optionChipLabel, WEB_CRISP_TEXT]}>{option.label}</Text>
              <Text style={[styles.optionChipValue, WEB_CRISP_TEXT]}>{option.chance}%</Text>
            </View>
          ))}
        </View>
        <View style={styles.cardFooter}>
          <Text style={[styles.meta, WEB_CRISP_TEXT]}>{market.closeTime}</Text>
          <Text style={[styles.volume, WEB_CRISP_TEXT]}>{market.volume}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

export function LandingMarketPreview({ markets, activeIndex, onSelectIndex }: Props) {
  const { width } = useWindowDimensions();
  const isCompact = width < 480;
  const lift = useSharedValue(0);
  const cardWidth = useSharedValue(0);

  const cardShellStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }],
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    cardWidth.value = event.nativeEvent.layout.width;
  };

  const handlePointerEnter = () => {
    if (Platform.OS !== 'web') return;
    lift.value = withSpring(-3, SPRING_SNAPPY);
  };

  const handlePointerLeave = () => {
    lift.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
  };

  return (
    <View style={[styles.wrap, isCompact && styles.wrapCompact]}>
      <View style={styles.tabs}>
        {markets.map((market, index) => {
          const active = index === activeIndex;
          return (
            <AnimatedPressable
              key={market.group}
              onPress={() => onSelectIndex(index)}
              style={[styles.tab, active && styles.tabActive, Platform.OS === 'web' && ({ cursor: 'pointer' } as object)]}
            >
              {active ? <Animated.View entering={FadeIn.duration(180)} style={styles.tabGlow} /> : null}
              <Text style={[styles.tabText, active && styles.tabTextActive, WEB_CRISP_TEXT]}>{market.group}</Text>
            </AnimatedPressable>
          );
        })}
      </View>

      <Animated.View
        style={[styles.cardShell, cardShellStyle]}
        onLayout={handleLayout}
        {...(Platform.OS === 'web'
          ? ({
              onPointerEnter: handlePointerEnter,
              onPointerLeave: handlePointerLeave,
            } as object)
          : {})}
      >
        <View style={styles.cardShadow} pointerEvents="none" />
        <MarketCard key={markets[activeIndex].question} market={markets[activeIndex]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    maxWidth: 440,
    gap: 16,
    alignSelf: 'center',
  },
  wrapCompact: {
    maxWidth: '100%',
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  tab: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Marketing.heroBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          transition: 'border-color 220ms cubic-bezier(0.16, 1, 0.3, 1), background-color 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        } as object)
      : {}),
  },
  tabActive: {
    borderColor: 'rgba(0, 106, 220, 0.45)',
    backgroundColor: 'rgba(0, 106, 220, 0.12)',
  },
  tabGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 106, 220, 0.08)',
  },
  tabText: {
    color: Marketing.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#E2E8F0',
  },
  cardShell: {
    position: 'relative',
    borderRadius: 22,
  },
  cardShadow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.4)',
        } as object)
      : {}),
  },
  card: {
    borderRadius: 22,
    padding: 20,
    gap: 14,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
        } as object)
      : {}),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Brand.success,
  },
  liveText: {
    color: '#86EFAC',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  groupLabel: {
    color: Marketing.textMuted,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  question: {
    color: '#F8FAFC',
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '500',
    letterSpacing: -0.35,
  },
  meterBlock: {
    gap: 8,
  },
  meterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meterLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    paddingRight: 12,
  },
  meterValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  meterTrack: {
    height: 7,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  meterFill: {
    height: '100%',
    width: '100%',
    borderRadius: 999,
    backgroundColor: Brand.primary,
    transformOrigin: 'left center',
    ...(Platform.OS === 'web' ? ({ transformOrigin: 'left center' } as object) : {}),
  },
  optionsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: Marketing.heroBorder,
  },
  optionChipLabel: {
    color: Marketing.textMuted,
    fontSize: 11,
  },
  optionChipValue: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 2,
  },
  meta: {
    flex: 1,
    color: Marketing.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  volume: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '600',
  },
});
