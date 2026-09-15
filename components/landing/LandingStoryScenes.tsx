import { Brand, Marketing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { SPRING_GENTLE, SPRING_SNAPPY } from './landing-constants';
import { useLandingScroll } from './LandingScrollContext';

const CHAT_LINES = [
  { user: 'sam', text: 'Opening weekend will tell us everything.', delay: 0 },
  { user: 'alex', text: '💸 500 credits on Yes, $2B+', bet: true, delay: 400 },
  { user: 'nina', text: 'Repeat viewings push it over.', delay: 800 },
  { user: 'leo', text: '💸 250 credits on Maya', bet: true, delay: 1200 },
];

const FLOW_STEPS = [
  {
    icon: 'people-circle-outline' as const,
    title: 'Create',
    detail: 'Spin up a private group market in seconds.',
    accent: Brand.primary,
  },
  {
    icon: 'trending-up-outline' as const,
    title: 'Bet',
    detail: 'Stake play credits or verified funds where allowed.',
    accent: '#22C55E',
  },
  {
    icon: 'trophy-outline' as const,
    title: 'Settle',
    detail: 'Outcomes resolve automatically when events conclude.',
    accent: '#818CF8',
  },
];

export function LandingGroupScene() {
  const pulse = useSharedValue(0);

  React.useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.08 }],
    opacity: 0.35 + pulse.value * 0.25,
  }));

  return (
    <View style={styles.groupWrap}>
      <View style={styles.groupCopy}>
        <Text style={styles.chapterEyebrow}>02 · Your people</Text>
        <Text style={styles.chapterTitle}>Predictions live where your group already is</Text>
        <Text style={styles.chapterBody}>
          Markets sit inside group chat — banter, conviction, and live odds in one thread.
        </Text>
      </View>

      <View style={styles.groupVisual}>
        <Animated.View style={[styles.groupRing, ringStyle]} />
        <View style={styles.avatarCluster}>
          {['M', 'S', 'A', 'N'].map((initial, index) => (
            <View key={initial} style={[styles.avatar, { marginLeft: index === 0 ? 0 : -10, zIndex: 4 - index }]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          ))}
        </View>

        <View style={styles.chatStack}>
          {CHAT_LINES.map((line, index) => (
            <ChatBubble key={`${line.user}-${index}`} line={line} index={index} />
          ))}
        </View>
      </View>
    </View>
  );
}

function ChatBubble({
  line,
  index,
}: {
  line: (typeof CHAT_LINES)[number];
  index: number;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  React.useEffect(() => {
    opacity.value = withDelay(line.delay, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
    translateY.value = withDelay(line.delay, withSpring(0, SPRING_GENTLE));
  }, [line.delay, opacity, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.chatBubble, line.bet && styles.chatBubbleBet, style]}>
      <Text style={[styles.chatUser, line.bet && styles.chatUserBet]}>@{line.user}</Text>
      <Text style={[styles.chatText, line.bet && styles.chatTextBet]}>{line.text}</Text>
    </Animated.View>
  );
}

export function LandingFlowScene() {
  const { scrollY, viewportHeight, sectionOffsets } = useLandingScroll();
  const { height } = useWindowDimensions();
  const [activeStep, setActiveStep] = React.useState(0);

  const trackFillStyle = useAnimatedStyle(() => {
    const offset = sectionOffsets.value.flow ?? 0;
    const vh = viewportHeight.value || height;
    const progress = interpolate(scrollY.value, [offset, offset + vh * 0.85], [0, 1], Extrapolation.CLAMP);
    return { transform: [{ scaleX: progress }] };
  });

  React.useEffect(() => {
    const id = setInterval(() => {
      setActiveStep((current) => (current + 1) % FLOW_STEPS.length);
    }, 4200);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={styles.flowWrap}>
      <View style={styles.flowCopy}>
        <Text style={styles.chapterEyebrow}>03 · The loop</Text>
        <Text style={styles.chapterTitle}>Create. Bet. Settle.</Text>
        <Text style={styles.chapterBody}>Play credits by default. Live wallet where verified and allowed.</Text>
      </View>

      <View style={styles.flowTimeline}>
        <View style={styles.flowTrack}>
          <Animated.View style={[styles.flowTrackFill, trackFillStyle]} />
        </View>

        {FLOW_STEPS.map((step, index) => {
          const isActive = index === activeStep;
          return (
            <FlowStepCard key={step.title} step={step} index={index} active={isActive} onPress={() => setActiveStep(index)} />
          );
        })}
      </View>
    </View>
  );
}

function FlowStepCard({
  step,
  index,
  active,
  onPress,
}: {
  step: (typeof FLOW_STEPS)[number];
  index: number;
  active: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(active ? 1 : 0.98);

  React.useEffect(() => {
    scale.value = withSpring(active ? 1 : 0.98, SPRING_SNAPPY);
  }, [active, scale]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderColor: active ? `${step.accent}66` : Marketing.heroBorder,
    backgroundColor: active ? `${step.accent}14` : 'rgba(255,255,255,0.02)',
  }));

  return (
    <Pressable
      onPress={onPress}
      style={Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : undefined}
    >
      <Animated.View style={[styles.flowCard, cardStyle]}>
        <View style={[styles.flowIcon, { backgroundColor: `${step.accent}20` }]}>
          <Ionicons name={step.icon} size={20} color={step.accent} />
        </View>
        <Text style={styles.flowIndex}>0{index + 1}</Text>
        <Text style={[styles.flowTitle, active && { color: '#F8FAFC' }]}>{step.title}</Text>
        {active ? <Text style={styles.flowDetail}>{step.detail}</Text> : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  groupWrap: {
    gap: 36,
  },
  groupCopy: {
    gap: 12,
    maxWidth: 520,
  },
  chapterEyebrow: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  chapterTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '300',
    letterSpacing: -1.2,
  },
  chapterBody: {
    color: Marketing.textMuted,
    fontSize: 16,
    lineHeight: 26,
  },
  groupVisual: {
    alignItems: 'center',
    gap: 22,
    paddingVertical: 12,
  },
  groupRing: {
    position: 'absolute',
    top: 24,
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: 'rgba(0, 106, 220, 0.25)',
    backgroundColor: 'rgba(0, 106, 220, 0.06)',
  },
  avatarCluster: {
    flexDirection: 'row',
    marginTop: 48,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Marketing.heroBackground,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  chatStack: {
    width: '100%',
    maxWidth: 420,
    gap: 8,
  },
  chatBubble: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: Marketing.heroBorder,
    alignSelf: 'flex-start',
    maxWidth: '92%',
  },
  chatBubbleBet: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderColor: 'rgba(34, 197, 94, 0.2)',
    alignSelf: 'flex-end',
  },
  chatUser: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  chatUserBet: {
    color: '#86EFAC',
  },
  chatText: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 18,
  },
  chatTextBet: {
    color: '#BBF7D0',
    fontWeight: '500',
  },
  flowWrap: {
    gap: 28,
  },
  flowCopy: {
    gap: 12,
    maxWidth: 520,
  },
  flowTimeline: {
    gap: 12,
    position: 'relative',
  },
  flowTrack: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: 18,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  flowTrackFill: {
    height: '100%',
    width: '100%',
    backgroundColor: Brand.primary,
    transformOrigin: 'left center',
    ...(Platform.OS === 'web' ? ({ transformOrigin: 'left center' } as object) : {}),
  },
  flowCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    gap: 6,
    ...(Platform.OS === 'web'
      ? ({
          transition: 'border-color 240ms ease, background-color 240ms ease',
          cursor: 'pointer',
        } as object)
      : {}),
  },
  flowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowIndex: {
    color: Marketing.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  flowTitle: {
    color: Marketing.textMuted,
    fontSize: 20,
    fontWeight: '500',
    letterSpacing: -0.4,
  },
  flowDetail: {
    color: Marketing.textMuted,
    fontSize: 13,
    lineHeight: 20,
    paddingTop: 2,
  },
});
