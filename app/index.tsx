import { SEO } from '@/components/SEO';
import { LandingBackground } from '@/components/landing/LandingBackground';
import { LandingJoinSection } from '@/components/landing/LandingJoinSection';
import { LandingMarketPreview, type LandingMarket } from '@/components/landing/LandingMarketPreview';
import { LandingProgressNav } from '@/components/landing/LandingProgressNav';
import { LandingSection } from '@/components/landing/LandingSection';
import { LandingScrollProvider, useLandingScroll } from '@/components/landing/LandingScrollContext';
import { LandingFlowScene, LandingGroupScene } from '@/components/landing/LandingStoryScenes';
import { Brand, Marketing } from '@/constants/theme';
import type { ComplianceJurisdiction } from '@/lib/compliance/jurisdiction';
import { getPublicEnv } from '@/lib/public-env';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { WhatsAppContactLink } from '../components/WhatsAppContactLink';

const EXAMPLE_MARKETS: LandingMarket[] = [
  {
    group: 'Movie Night Crew',
    question: 'Will Avengers: Doomsday clear $2B worldwide?',
    closeTime: 'Settles after the theatrical box office run',
    volume: '7,850 credits',
    options: [
      { label: 'Yes, $2B+', chance: 44 },
      { label: 'No, under $2B', chance: 40 },
      { label: 'Too close to call', chance: 16 },
    ],
  },
  {
    group: 'Sales Floor',
    question: 'Who wins Salesperson of the Month?',
    closeTime: 'Closes when the monthly leaderboard is final',
    volume: '4,200 credits',
    options: [
      { label: 'Maya', chance: 36 },
      { label: 'Leo', chance: 29 },
      { label: 'Priya', chance: 22 },
      { label: 'Dark horse', chance: 13 },
    ],
  },
  {
    group: 'Product Team',
    question: 'Will the new app ship before Friday demo?',
    closeTime: 'Settles at the Friday demo cutoff',
    volume: '3,600 credits',
    options: [
      { label: 'Ships Friday', chance: 51 },
      { label: 'Slips next week', chance: 35 },
      { label: 'Ships with cuts', chance: 14 },
    ],
  },
  {
    group: 'Weekend League',
    question: "Which team wins Saturday's five-a-side final?",
    closeTime: 'Settles after the final whistle',
    volume: '5,450 credits',
    options: [
      { label: 'Northside FC', chance: 46 },
      { label: 'La Floresta', chance: 33 },
      { label: 'Penalty shootout', chance: 21 },
    ],
  },
];

const AnimatedScrollView = Animated.ScrollView;

const ACCESS_STEPS = ['Get invited', 'Sign up', 'Verify'];

function resolveLaunchJurisdiction(): ComplianceJurisdiction {
  return getPublicEnv().launchJurisdiction.toUpperCase() === 'EC' ? 'EC' : 'US';
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        styles.primaryButton,
        (hovered || pressed) && styles.primaryButtonActive,
        Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
      ]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
      <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
    </Pressable>
  );
}

function ScrollHint() {
  const bounce = useSharedValue(0);

  React.useEffect(() => {
    bounce.value = withRepeat(
      withSequence(
        withTiming(6, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [bounce]);

  const hintStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bounce.value }],
    opacity: interpolate(bounce.value, [0, 6], [0.55, 1]),
  }));

  return (
    <Animated.View style={[styles.scrollHint, hintStyle]}>
      <Text style={styles.scrollHintText}>Scroll to explore</Text>
      <Ionicons name="chevron-down" size={16} color={Marketing.textMuted} />
    </Animated.View>
  );
}

function LandingPageContent() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isWide = width >= 900;
  const isCompact = width < 480;
  const showSideNav = width >= 768;
  const launchJurisdiction = React.useMemo(() => resolveLaunchJurisdiction(), []);
  const isPrivateBeta = getPublicEnv().betaRequired === 'true';
  const residentLabel = launchJurisdiction === 'EC' ? 'Ecuador' : 'United States';
  const [marketIndex, setMarketIndex] = React.useState(0);
  const userPausedMarkets = React.useRef(false);
  const scrollRef = React.useRef<Animated.ScrollView>(null);
  const { scrollY, viewportHeight, sectionOffsets, activeSection } = useLandingScroll();

  React.useEffect(() => {
    const interval = setInterval(() => {
      if (userPausedMarkets.current) return;
      setMarketIndex((currentIndex) => (currentIndex + 1) % EXAMPLE_MARKETS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const setActive = React.useCallback(
    (nextId: string) => {
      activeSection.value = nextId;
    },
    [activeSection],
  );

  useAnimatedReaction(
    () => scrollY.value,
    (y) => {
      const vh = viewportHeight.value || height;
      const offsets = sectionOffsets.value;
      const ids = Object.keys(offsets);
      if (ids.length === 0) return;

      let closestId = ids[0];
      let closestDistance = Number.POSITIVE_INFINITY;
      for (const sectionId of ids) {
        const distance = Math.abs(y + vh * 0.38 - offsets[sectionId]);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestId = sectionId;
        }
      }
      if (closestId !== activeSection.value) {
        runOnJS(setActive)(closestId);
      }
    },
    [height],
  );

  const navStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 60, 140], [1, 1, 0.98], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(scrollY.value, [0, 120], [0, -2], Extrapolation.CLAMP),
      },
    ],
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: `blur(${interpolate(scrollY.value, [0, 120], [0, 14], Extrapolation.CLAMP)}px)`,
          WebkitBackdropFilter: `blur(${interpolate(scrollY.value, [0, 120], [0, 14], Extrapolation.CLAMP)}px)`,
          backgroundColor: `rgba(3, 7, 18, ${interpolate(scrollY.value, [0, 120], [0, 0.72], Extrapolation.CLAMP)})`,
        } as object)
      : {}),
  }));

  const heroParallaxStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(scrollY.value, [0, height * 0.6], [0, -48], Extrapolation.CLAMP),
      },
    ],
    opacity: interpolate(scrollY.value, [0, height * 0.45], [1, 0.35], Extrapolation.CLAMP),
  }));

  const handleMarketSelect = (index: number) => {
    userPausedMarkets.current = true;
    setMarketIndex(index);
    setTimeout(() => {
      userPausedMarkets.current = false;
    }, 12000);
  };

  const navigateToSection = (_sectionId: string, offset: number) => {
    scrollRef.current?.scrollTo({ y: Math.max(0, offset), animated: true });
  };

  return (
    <View style={styles.container}>
      <SEO
        title={
          isPrivateBeta && launchJurisdiction === 'EC'
            ? 'Private invite-only beta — future prediction infrastructure'
            : 'Future prediction infrastructure for private groups'
        }
        description={
          isPrivateBeta
            ? `Anymarkt is in a private invite-only beta for ${residentLabel} residents. Turn movies, office competitions, games, and real-life moments into private prediction markets.`
            : 'Anymarkt helps private groups turn movies, office competitions, games, and real-life moments into prediction markets.'
        }
        image="/og-image.svg"
        imageAlt="Anymarkt future prediction infrastructure for private groups"
        url="/"
        keywords={
          isPrivateBeta
            ? 'Anymarkt, private beta, invite-only, Ecuador, prediction infrastructure, future-event markets, Play Mode'
            : 'Anymarkt, prediction infrastructure, future-event markets, private prediction markets, Play Mode, group predictions'
        }
      />

      <LandingBackground scrollY={scrollY} />

      {showSideNav ? <LandingProgressNav onNavigate={navigateToSection} /> : null}

      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.fixedNav, navStyle]}>
          <View style={[styles.navInner, isCompact && styles.navInnerCompact]}>
            <View style={styles.brandWrap}>
              <Image
                source={require('../assets/images/icon.svg')}
                style={[styles.brandLogo, isCompact && styles.brandLogoCompact]}
                contentFit="contain"
              />
              <Text style={[styles.brand, isCompact && styles.brandCompact]}>Anymarkt</Text>
            </View>
            <TouchableOpacity
              style={[styles.navButton, Platform.OS === 'web' && ({ cursor: 'pointer' } as any)]}
              onPress={() => router.push('/login')}
              activeOpacity={0.8}
            >
              <Text style={styles.navButtonText}>Log in</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <AnimatedScrollView
          ref={scrollRef}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.scrollContent,
            Platform.OS === 'web' && (styles.scrollSnap as object),
          ]}
          showsVerticalScrollIndicator={false}
        >
          <LandingSection id="vision" tint="blue" crispContent>
            <Animated.View style={[styles.hero, isWide && styles.heroWide, heroParallaxStyle]}>
              <View style={[styles.copy, isWide && styles.copyWide]}>
                {isPrivateBeta ? (
                  <View style={styles.betaPill}>
                    <View style={styles.betaDot} />
                    <Text style={styles.betaPillText}>Private invite-only beta · {launchJurisdiction} residents</Text>
                  </View>
                ) : null}

                <Text style={[styles.title, isWide && styles.titleWide, isCompact && styles.titleCompact]}>
                  Infrastructure to predict the future together
                </Text>
                <Text style={[styles.subtitle, isWide && styles.subtitleWide]}>
                  Prediction infrastructure at your fingertips: create private group prediction markets on movies, office
                  competitions, games, and real-life moments. Your community bets on outcomes with play credits, or verified
                  funds where allowed.
                </Text>

                {isPrivateBeta ? (
                  <View style={styles.ctaBlock}>
                    <PrimaryButton label="Request access" onPress={() => router.push('/request-access')} />
                    <View style={styles.secondaryCtaRow}>
                      <Text style={styles.ctaHelperSecondary}>Need help?</Text>
                      <WhatsAppContactLink variant="link" iconSize={18} />
                    </View>
                  </View>
                ) : (
                  <PrimaryButton label="Start predicting" onPress={() => router.push('/login?mode=signup')} />
                )}

                <Text style={styles.trustLine}>
                  {isPrivateBeta ? `${residentLabel} residents · 17+` : 'Private group markets · Play credits · 17+'}
                </Text>
              </View>

              {!isWide ? (
                <View style={styles.heroVisualCompact}>
                  <LandingMarketPreview
                    markets={EXAMPLE_MARKETS}
                    activeIndex={marketIndex}
                    onSelectIndex={handleMarketSelect}
                  />
                </View>
              ) : null}

              <ScrollHint />
            </Animated.View>
          </LandingSection>

          <LandingSection id="markets" tint="green" crispContent>
            <View style={[styles.chapterLayout, isWide && styles.chapterLayoutWide]}>
              <View style={styles.chapterIntro}>
                <Text style={styles.chapterEyebrow}>01 · Live markets</Text>
                <Text style={styles.chapterTitle}>Odds move as conviction builds</Text>
                <Text style={styles.chapterBody}>
                  Every group market updates in real time — volume, favorites, and sentiment visible at a glance.
                </Text>
              </View>
              <LandingMarketPreview markets={EXAMPLE_MARKETS} activeIndex={marketIndex} onSelectIndex={handleMarketSelect} />
            </View>
          </LandingSection>

          <LandingSection id="group" tint="violet">
            <LandingGroupScene />
          </LandingSection>

          <LandingSection id="flow" tint="blue">
            <LandingFlowScene />
          </LandingSection>

          <LandingSection id="join" fullViewport tint="blue" persistVisible>
            <LandingJoinSection
              launchJurisdiction={launchJurisdiction}
              isPrivateBeta={isPrivateBeta}
              residentLabel={residentLabel}
              accessSteps={isPrivateBeta ? ACCESS_STEPS : undefined}
              primaryLabel={isPrivateBeta ? 'Request access' : 'Start predicting'}
              onPrimaryAction={() =>
                router.push(isPrivateBeta ? '/request-access' : ('/login?mode=signup' as any))
              }
            />
          </LandingSection>
        </AnimatedScrollView>
      </SafeAreaView>
    </View>
  );
}

export default function LandingPage() {
  const { height } = useWindowDimensions();
  return (
    <LandingScrollProvider viewportHeight={height}>
      <LandingPageContent />
    </LandingScrollProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Marketing.heroBackground,
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
  },
  fixedNav: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 12,
    paddingTop: Platform.OS === 'web' ? 12 : 0,
  },
  navInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1180,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  navInnerCompact: {
    paddingHorizontal: 18,
  },
  scrollContent: {
    paddingTop: Platform.OS === 'web' ? 72 : 56,
    paddingBottom: 48,
  },
  scrollSnap: {
    scrollSnapType: 'y proximity',
  } as object,
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogo: {
    width: 40,
    height: 40,
  },
  brandLogoCompact: {
    width: 34,
    height: 34,
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: -0.5,
  },
  brandCompact: {
    fontSize: 20,
  },
  navButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: Marketing.heroBorder,
  },
  navButtonText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '500',
  },
  hero: {
    justifyContent: 'center',
    gap: 28,
    paddingVertical: 24,
    minHeight: 560,
  },
  heroWide: {
    minHeight: 620,
    maxWidth: 680,
  },
  copy: {
    gap: 20,
  },
  copyWide: {
    maxWidth: 560,
  },
  heroVisualCompact: {
    paddingTop: 8,
  },
  betaPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(0, 106, 220, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 106, 220, 0.28)',
  },
  betaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Brand.primary,
  },
  betaPillText: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.15,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '300',
    letterSpacing: -1.8,
    maxWidth: 680,
  },
  titleWide: {
    fontSize: 58,
    lineHeight: 62,
    letterSpacing: -2.2,
  },
  titleCompact: {
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -1.2,
  },
  subtitle: {
    color: Marketing.textMuted,
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '400',
    maxWidth: 520,
  },
  subtitleWide: {
    fontSize: 17,
    lineHeight: 27,
    maxWidth: 540,
  },
  ctaBlock: {
    gap: 10,
    paddingTop: 2,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 999,
    minHeight: 50,
    paddingHorizontal: 22,
    backgroundColor: Brand.primary,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 14px 28px rgba(0, 106, 220, 0.28)',
          transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        } as any)
      : {}),
  },
  primaryButtonActive: {
    ...(Platform.OS === 'web'
      ? ({
          transform: 'translateY(-2px) scale(1.02)',
          boxShadow: '0 20px 40px rgba(0, 106, 220, 0.36)',
        } as any)
      : {}),
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  secondaryCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  ctaHelperSecondary: {
    color: Marketing.textMuted,
    fontSize: 13,
  },
  trustLine: {
    color: Marketing.textMuted,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  scrollHint: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  scrollHintText: {
    color: Marketing.textMuted,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  chapterLayout: {
    gap: 32,
  },
  chapterLayoutWide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 48,
  },
  chapterIntro: {
    flex: 1,
    gap: 12,
    maxWidth: 420,
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
});
