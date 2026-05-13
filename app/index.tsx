import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Animated, Easing, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SEO } from '../components/SEO';

const BRAND_DEEP_BLUE = '#1A2F5C';
const BRAND_ACCENT_BLUE = '#2A5BFF';

const EXAMPLE_MARKETS = [
  {
    group: 'Family group',
    question: 'Who gets married first?',
    closeTime: 'Closes after New Year dinner',
    options: [
      { label: 'Maya', chance: 38 },
      { label: 'Leo', chance: 31 },
      { label: 'Priya', chance: 21 },
      { label: 'Dark horse', chance: 10 },
    ],
  },
  {
    group: 'Office poker night',
    question: 'Who wins Friday poker?',
    closeTime: 'Locks at first deal',
    options: [
      { label: 'Alex', chance: 34 },
      { label: 'Sam', chance: 28 },
      { label: 'Nina', chance: 22 },
      { label: 'Rafa', chance: 16 },
    ],
  },
  {
    group: 'Weekend volleyball',
    question: 'Which team takes the match?',
    closeTime: 'Settles after best of 3',
    options: [
      { label: 'Blue team', chance: 46 },
      { label: 'Green team', chance: 39 },
      { label: 'Rain delay', chance: 15 },
    ],
  },
  {
    group: 'Roommate league',
    question: 'Who pays for brunch next?',
    closeTime: 'Closes Sunday at noon',
    options: [
      { label: 'The late one', chance: 41 },
      { label: 'The chef', chance: 33 },
      { label: 'Split pot', chance: 26 },
    ],
  },
];

const HOW_IT_WORKS_STEPS = [
  { icon: 'people-circle-outline', title: 'Invite your group' },
  { icon: 'trending-up-outline', title: 'Back an outcome' },
  { icon: 'trophy-outline', title: 'Settle together' },
];

export default function LandingPage() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isWide = width >= 820;
  const isCompact = width < 480;
  const heroSectionMinHeight = isWide ? Math.max(560, height * 0.78) : Math.max(620, height * 0.84);
  const [marketIndex, setMarketIndex] = React.useState(0);
  const currentMarket = EXAMPLE_MARKETS[marketIndex];
  const leadOption = currentMarket.options[0];
  const stepsAnim = React.useRef(new Animated.Value(0)).current;
  const iconFloatAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const interval = setInterval(() => {
      setMarketIndex((currentIndex) => (currentIndex + 1) % EXAMPLE_MARKETS.length);
    }, 3200);

    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    Animated.timing(stepsAnim, {
      toValue: 1,
      duration: 620,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(iconFloatAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(iconFloatAnim, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    return () => loop.stop();
  }, [iconFloatAnim, stepsAnim]);

  return (
    <View style={styles.container}>
      <SEO
        title="Predict the Future with friends"
        description="Prediction markets with friends on AnyMarket—invite, predict, settle."
        image="/og-image.svg"
        imageAlt="AnyMarket lets friends predict future outcomes together"
        url="/"
        keywords="AnyMarket, social prediction market platform, predict the Future with friends, private prediction markets, prediction rewards"
      />
      <View style={styles.glowOne} />
      <View style={styles.glowTwo} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={[styles.content, isCompact && styles.contentCompact]} showsVerticalScrollIndicator={false}>
          <View style={styles.nav}>
            <View style={styles.brandWrap}>
              <Image
                source={require('../assets/images/icon.svg')}
                style={[styles.brandLogo, isCompact && styles.brandLogoCompact]}
                contentFit="contain"
              />
              <Text style={[styles.brand, isCompact && styles.brandCompact]}>AnyMarket</Text>
            </View>
            <TouchableOpacity
              style={[styles.navButton, Platform.OS === 'web' && ({ cursor: 'pointer' } as any)]}
              onPress={() => router.push('/login')}
              activeOpacity={0.8}>
              <Text style={styles.navButtonText}>Log in</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.main, { minHeight: heroSectionMinHeight }, isWide && styles.mainWide]}>
            <View style={[styles.copy, isWide && styles.copyWide]}>
              <Text style={[styles.title, isWide && styles.titleWide, isCompact && styles.titleCompact]}>
                Predict the Future with friends
              </Text>
              <Text style={styles.subtitle}>
                Private markets with friends—invite, predict, settle in one place.
              </Text>

              <View style={styles.ctaRow}>
                <TouchableOpacity
                  style={[styles.primaryButton, Platform.OS === 'web' && ({ cursor: 'pointer' } as any)]}
                  onPress={() => router.push('/login?mode=signup')}
                  activeOpacity={0.85}>
                  <Text style={styles.primaryButtonText}>Create a group</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryButton, Platform.OS === 'web' && ({ cursor: 'pointer' } as any)]}
                  onPress={() => router.push('/login')}
                  activeOpacity={0.85}>
                  <Text style={styles.secondaryButtonText}>Log in</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.trustLine}>Private · Invite codes · Settle with your group</Text>
            </View>

            <View style={[styles.visualPanel, isWide && styles.visualPanelWide, isCompact && styles.visualPanelCompact]}>
              <View style={styles.heroImageCard}>
                <Image
                  source={require('../assets/images/bettinglandingpageimage3.png')}
                  style={styles.heroImage}
                  contentFit="cover"
                  contentPosition="center"
                  transition={300}
                />
                <View style={styles.imageShade} />
              </View>
              <View style={styles.marketTicket}>
                <View style={styles.panelHeader}>
                  <View>
                    <Text style={styles.panelLabel}>Live group market</Text>
                    <Text style={styles.panelGroup}>{currentMarket.group}</Text>
                  </View>
                  <View style={styles.livePill}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                </View>
                <Text style={styles.marketQuestion}>{currentMarket.question}</Text>
                <View style={styles.optionsList}>
                  {currentMarket.options.map((option, index) => (
                    <View key={option.label} style={[styles.optionRow, index === 0 && styles.optionRowLead]}>
                      <View style={styles.optionTextWrap}>
                        <Text style={[styles.optionLabel, index === 0 && styles.optionLabelLead]}>{option.label}</Text>
                        {index === 0 ? <Text style={styles.optionNote}>current favorite</Text> : null}
                      </View>
                      <View style={styles.optionMeterTrack}>
                        <View style={[styles.optionMeterFill, { width: `${option.chance}%` }]} />
                      </View>
                      <Text style={[styles.optionChance, index === 0 && styles.optionChanceLead]}>{option.chance}%</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.ticketFooter}>
                  <Text style={styles.closeTime}>{currentMarket.closeTime}</Text>
                  <Text style={styles.favoriteLabel}>{leadOption.label} leads</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.stepsSection}>
            <Text style={styles.stepsTitle}>How it works</Text>
            <View style={[styles.stepsGraph, isWide && styles.stepsGraphWide]}>
              {HOW_IT_WORKS_STEPS.map((step, index) => {
                const translateY = stepsAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [18 + index * 4, 0],
                });
                const iconTranslateY = iconFloatAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -4],
                });

                return (
                  <View key={step.title} style={[styles.graphNodeWrap, isWide && styles.graphNodeWrapWide]}>
                    <Animated.View
                      style={[
                        styles.stepCard,
                        {
                          opacity: stepsAnim,
                          transform: [{ translateY }],
                        },
                      ]}
                    >
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>{index + 1}</Text>
                      </View>
                      <Animated.View style={[styles.stepIcon, { transform: [{ translateY: iconTranslateY }] }]}>
                        <Ionicons name={step.icon as any} size={22} color={BRAND_ACCENT_BLUE} />
                      </Animated.View>
                      <View style={styles.stepTextWrap}>
                        <Text style={styles.stepTitle}>{step.title}</Text>
                      </View>
                    </Animated.View>
                    {index < HOW_IT_WORKS_STEPS.length - 1 ? (
                      <View style={[styles.graphConnector, isWide ? styles.graphConnectorWide : styles.graphConnectorStacked]}>
                        <View style={[styles.graphConnectorLine, isWide ? styles.graphConnectorLineWide : styles.graphConnectorLineStacked]} />
                        <Ionicons
                          name={isWide ? 'chevron-forward' : 'chevron-down'}
                          size={16}
                          color={BRAND_ACCENT_BLUE}
                          style={styles.graphConnectorArrow}
                        />
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
  },
  glowOne: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(15, 92, 255, 0.13)',
  },
  glowTwo: {
    position: 'absolute',
    bottom: -160,
    left: -110,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 1360,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  contentCompact: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandLogo: {
    width: 46,
    height: 46,
  },
  brandLogoCompact: {
    width: 38,
    height: 38,
  },
  brand: {
    color: BRAND_DEEP_BLUE,
    fontSize: 34,
    fontWeight: '400',
    letterSpacing: -0.9,
  },
  brandCompact: {
    fontSize: 28,
    letterSpacing: -0.7,
  },
  navButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  navButtonText: {
    color: BRAND_DEEP_BLUE,
    fontSize: 14,
    fontWeight: '400',
  },
  main: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 24,
  },
  mainWide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 48,
    paddingVertical: 32,
  },
  copy: {
    gap: 18,
  },
  copyWide: {
    flex: 1,
    maxWidth: 560,
  },
  title: {
    color: BRAND_DEEP_BLUE,
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '300',
    letterSpacing: -1.5,
    maxWidth: 720,
  },
  titleWide: {
    fontSize: 60,
    lineHeight: 62,
    letterSpacing: -2,
  },
  titleCompact: {
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: -1.2,
  },
  subtitle: {
    color: '#4F5F72',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    maxWidth: 520,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 4,
    flexWrap: 'wrap',
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    minWidth: 148,
    height: 52,
    paddingHorizontal: 22,
    backgroundColor: BRAND_DEEP_BLUE,
    ...Platform.select({
      web: {
        boxShadow: '0px 10px 16px rgba(26, 47, 92, 0.18)',
      },
      default: {
        shadowColor: BRAND_DEEP_BLUE,
        shadowOpacity: 0.18,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
        elevation: 5,
      },
    }),
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    minWidth: 112,
    height: 52,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.10)',
  },
  secondaryButtonText: {
    color: BRAND_DEEP_BLUE,
    fontSize: 15,
    fontWeight: '400',
  },
  trustLine: {
    color: '#718096',
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.15,
    marginTop: 4,
  },
  visualPanel: {
    height: 460,
    gap: 12,
  },
  visualPanelWide: {
    flex: 0.92,
    height: 620,
  },
  visualPanelCompact: {
    height: 500,
    borderRadius: 24,
  },
  heroImageCard: {
    flex: 1.45,
    minHeight: 250,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    ...Platform.select({
      web: {
        boxShadow: '0px 10px 18px rgba(11, 27, 50, 0.12)',
      },
      default: {
        shadowColor: '#0B1B32',
        shadowOpacity: 0.12,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 6,
      },
    }),
  },
  heroImage: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.01 }],
  },
  imageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 7, 13, 0.05)',
  },
  marketTicket: {
    borderRadius: 22,
    padding: 16,
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.10)',
    ...Platform.select({
      web: {
        boxShadow: '0px 6px 12px rgba(11, 27, 50, 0.10)',
      },
      default: {
        shadowColor: '#0B1B32',
        shadowOpacity: 0.1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
      },
    }),
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelLabel: {
    color: '#718096',
    fontSize: 11,
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  panelGroup: {
    color: BRAND_DEEP_BLUE,
    fontSize: 14,
    fontWeight: '400',
    marginTop: 3,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#EAF8EF',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
  },
  liveText: {
    color: '#1A7A3E',
    fontSize: 11,
    fontWeight: '400',
  },
  marketQuestion: {
    color: BRAND_DEEP_BLUE,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '400',
    letterSpacing: -0.4,
  },
  optionsList: {
    gap: 8,
  },
  optionRow: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F4F7FB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionRowLead: {
    backgroundColor: '#EEF4FF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(36, 91, 255, 0.22)',
  },
  optionTextWrap: {
    width: 104,
  },
  optionLabel: {
    color: '#243145',
    fontSize: 14,
    fontWeight: '400',
  },
  optionLabelLead: {
    color: BRAND_DEEP_BLUE,
  },
  optionNote: {
    color: BRAND_ACCENT_BLUE,
    fontSize: 11,
    fontWeight: '400',
    marginTop: 2,
  },
  optionMeterTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 23, 42, 0.09)',
  },
  optionMeterFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: BRAND_ACCENT_BLUE,
  },
  optionChance: {
    width: 42,
    textAlign: 'right',
    color: '#526173',
    fontSize: 14,
    fontWeight: '400',
  },
  optionChanceLead: {
    color: BRAND_DEEP_BLUE,
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15, 23, 42, 0.10)',
    paddingTop: 12,
  },
  closeTime: {
    flex: 1,
    color: '#718096',
    fontSize: 12,
    fontWeight: '400',
  },
  favoriteLabel: {
    color: BRAND_DEEP_BLUE,
    fontSize: 12,
    fontWeight: '400',
  },
  stepsSection: {
    paddingBottom: 28,
    paddingTop: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15, 23, 42, 0.08)',
    gap: 14,
  },
  stepsTitle: {
    color: BRAND_DEEP_BLUE,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  stepsGraph: {
    gap: 8,
    marginTop: 0,
  },
  stepsGraphWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 0,
  },
  graphNodeWrap: {
    width: '100%',
  },
  graphNodeWrapWide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  graphConnector: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  graphConnectorWide: {
    width: 36,
  },
  graphConnectorStacked: {
    height: 28,
  },
  graphConnectorLine: {
    position: 'absolute',
    backgroundColor: 'rgba(42, 91, 255, 0.22)',
  },
  graphConnectorLineWide: {
    left: 0,
    right: 0,
    top: '50%',
    height: 2,
  },
  graphConnectorLineStacked: {
    top: 0,
    bottom: 0,
    width: 2,
  },
  graphConnectorArrow: {
    borderRadius: 999,
    backgroundColor: '#EEF4FF',
  },
  stepCard: {
    flex: 1,
    minHeight: 72,
    borderRadius: 20,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(42, 91, 255, 0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_DEEP_BLUE,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  stepIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF4FF',
  },
  stepTextWrap: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    color: BRAND_DEEP_BLUE,
    fontSize: 15,
    fontWeight: '400',
  },
  stepCopy: {
    color: '#526173',
    fontSize: 13,
    lineHeight: 17,
  },
});
