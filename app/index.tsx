import { SEO } from '@/components/SEO';
import { Brand, Marketing } from '@/constants/theme';
import type { ComplianceJurisdiction } from '@/lib/compliance/jurisdiction';
import { getJurisdictionDisclaimer, getJurisdictionLabel } from '@/lib/compliance/jurisdiction';
import { getPolicyDocuments, POLICY_ROUTE_ORDER, policyRouteWithJurisdiction } from '@/lib/legal/policy-content';
import { getPublicEnv } from '@/lib/public-env';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Animated, Easing, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { WhatsAppContactLink } from '../components/WhatsAppContactLink';

const BRAND_DARK_BG = Marketing.heroBackground;
const BRAND_DARK_BORDER = Marketing.heroBorder;
const BRAND_ACCENT_BLUE = Brand.primary;
const BRAND_PRIMARY = Brand.primary;
const BRAND_EMERALD = Brand.success;
const TEXT_MUTED = Marketing.textMuted;
const TEXT_LINK = Marketing.textLink;

const EXAMPLE_MARKETS = [
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
    chat: [
      { user: 'sam', message: 'Opening weekend will tell us everything.' },
      { user: 'alex', message: '💸 bet 500 credits on Yes, $2B+', isBet: true },
      { user: 'nina', message: 'I think repeat viewings push it over.' },
    ]
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
    chat: [
      { user: 'leo', message: 'Maya already closed two big accounts.' },
      { user: 'priya', message: '💸 bet 250 credits on Maya', isBet: true },
      { user: 'sam', message: 'Leo has three deals in procurement though.' },
    ]
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
    chat: [
      { user: 'mateo', message: 'Auth is done. Wallet copy is the last blocker.' },
      { user: 'elena', message: '💸 bet 300 credits on Ships Friday', isBet: true },
      { user: 'carlos', message: 'I am hedging on Ships with cuts.' },
    ]
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
    chat: [
      { user: 'sofia', message: 'Northside has the better keeper.' },
      { user: 'diego', message: '💸 bet 400 credits on Northside FC', isBet: true },
      { user: 'lucia', message: 'La Floresta always shows up in finals.' },
    ]
  },
];

const ACCESS_STEPS = ['Get invited', 'Sign up', 'Verify'];

const HOW_IT_WORKS_STEPS = [
  { icon: 'people-circle-outline', title: 'Create' },
  { icon: 'trending-up-outline', title: 'Bet' },
  { icon: 'trophy-outline', title: 'Settle' },
];

function resolveLaunchJurisdiction(): ComplianceJurisdiction {
  return getPublicEnv().launchJurisdiction.toUpperCase() === 'EC' ? 'EC' : 'US';
}

export default function LandingPage() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isWide = width >= 820;
  const isCompact = width < 480;
  const heroSectionMinHeight = isWide ? Math.max(560, height * 0.78) : Math.max(620, height * 0.84);
  const launchJurisdiction = React.useMemo(() => resolveLaunchJurisdiction(), []);
  const policyDocuments = React.useMemo(() => getPolicyDocuments(launchJurisdiction), [launchJurisdiction]);
  const jurisdictionLabel = getJurisdictionLabel(launchJurisdiction);
  const jurisdictionDisclaimer = getJurisdictionDisclaimer(launchJurisdiction);
  const isPrivateBeta = getPublicEnv().betaRequired === 'true';
  const residentLabel = launchJurisdiction === 'EC' ? 'Ecuador' : 'United States';
  const [marketIndex, setMarketIndex] = React.useState(0);
  const currentMarket = EXAMPLE_MARKETS[marketIndex];
  const stepsAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const interval = setInterval(() => {
      setMarketIndex((currentIndex) => (currentIndex + 1) % EXAMPLE_MARKETS.length);
    }, 4500); // slightly longer to allow reading the chat snippet

    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    Animated.timing(stepsAnim, {
      toValue: 1,
      duration: 620,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [stepsAnim]);

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
      <View style={styles.glowOne} />
      <View style={styles.glowTwo} />
      <View style={styles.glowThree} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={[styles.content, isCompact && styles.contentCompact]} showsVerticalScrollIndicator={false}>
          <View style={styles.nav}>
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
              activeOpacity={0.8}>
              <Text style={styles.navButtonText}>Log in</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.main, { minHeight: heroSectionMinHeight }, isWide && styles.mainWide]}>
            <View style={[styles.copy, isWide && styles.copyWide]}>
              {isPrivateBeta ? (
                <View style={styles.betaPill}>
                  <Text style={styles.betaPillText}>
                    Private invite-only beta · {launchJurisdiction} residents
                  </Text>
                </View>
              ) : null}
              <Text style={[styles.title, isWide && styles.titleWide, isCompact && styles.titleCompact]}>
                Infrastructure to predict the future together
              </Text>
              <Text style={styles.subtitle}>
                Prediction infrastructure at your fingertips: create private group prediction markets on movies, office competitions, games, and real-life moments. Your community bets on outcomes with play credits, or verified funds where allowed.
              </Text>
              {isPrivateBeta ? (
                <View style={styles.ctaBlock}>
                  <TouchableOpacity
                    style={[styles.primaryButton, Platform.OS === 'web' && ({ cursor: 'pointer' } as any)]}
                    onPress={() => router.push('/request-access')}
                    activeOpacity={0.85}>
                    <Text style={styles.primaryButtonText}>Request access</Text>
                  </TouchableOpacity>
                  <View style={styles.secondaryCtaRow}>
                    <Text style={styles.ctaHelperSecondary}>Need help?</Text>
                    <WhatsAppContactLink variant="link" iconSize={18} />
                  </View>
                </View>
              ) : (
                <View style={styles.ctaRow}>
                  <TouchableOpacity
                    style={[styles.primaryButton, Platform.OS === 'web' && ({ cursor: 'pointer' } as any)]}
                    onPress={() => router.push('/login?mode=signup')}
                    activeOpacity={0.85}>
                    <Text style={styles.primaryButtonText}>Start predicting</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.trustLine}>
                {isPrivateBeta
                  ? `${residentLabel} residents · 17+`
                  : 'Private group markets · Play credits · 17+'}
              </Text>
            </View>

            <View style={[styles.visualPanel, isWide && styles.visualPanelWide, isCompact && styles.visualPanelCompact]}>
              {/* High-Fidelity CSS Mock App UI */}
              <View style={styles.mockDeviceFrame}>
                {/* Device Status Bar */}
                <View style={styles.mockStatusBar}>
                  <Text style={styles.mockStatusBarTime}>9:41</Text>
                  <View style={styles.mockStatusBarIcons}>
                    <Ionicons name="wifi" size={12} color="rgba(255, 255, 255, 0.6)" />
                    <Ionicons name="battery-full" size={14} color="rgba(255, 255, 255, 0.6)" />
                  </View>
                </View>

                {/* App Header */}
                <View style={styles.mockAppHeader}>
                  <View style={styles.mockAppHeaderLeft}>
                    <View style={styles.mockGroupAvatar}>
                      <Text style={styles.mockGroupAvatarText}>M</Text>
                    </View>
                    <View>
                      <Text style={styles.mockGroupName}>{currentMarket.group}</Text>
                      <Text style={styles.mockGroupMembers}>12 members</Text>
                    </View>
                  </View>
                  <View style={styles.mockWalletBadge}>
                    <View style={styles.mockWalletDot} />
                    <Text style={styles.mockWalletText}>12,500 pts</Text>
                  </View>
                </View>

                {/* Live Market Ticket */}
                <View style={styles.marketTicket}>
                  <View style={styles.panelHeader}>
                    <View>
                      <Text style={styles.panelLabel}>GROUP MARKET</Text>
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
                    <Text style={styles.favoriteLabel}>Vol: {currentMarket.volume}</Text>
                  </View>
                </View>

                {/* Mock Group Chat Snippet */}
                <View style={styles.mockChatSection}>
                  <Text style={styles.mockChatHeader}>GROUP CHAT</Text>
                  <View style={styles.mockChatList}>
                    {currentMarket.chat.map((msg, idx) => (
                      <View key={idx} style={[styles.mockChatBubble, msg.isBet && styles.mockChatBubbleBet]}>
                        <Text style={[styles.mockChatUser, msg.isBet && styles.mockChatUserBet]}>@{msg.user}</Text>
                        <Text style={[styles.mockChatText, msg.isBet && styles.mockChatTextBet]}>{msg.message}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          </View>

          {isPrivateBeta ? (
            <View style={styles.accessSection}>
              <Text style={styles.sectionTitle}>Start safely</Text>
              <View style={styles.accessSteps}>
                {ACCESS_STEPS.map((step, index) => (
                  <React.Fragment key={step}>
                    {index > 0 ? <Text style={styles.accessDivider}>·</Text> : null}
                    <Text style={styles.accessInlineItem}>{step}</Text>
                  </React.Fragment>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.stepsSection}>
            <Text style={styles.stepsTitle}>How it works</Text>
            <Text style={styles.stepsHint}>Play credits by default. Live wallet where verified and allowed.</Text>
            <View style={[styles.stepsGraph, isWide && styles.stepsGraphWide]}>
              {HOW_IT_WORKS_STEPS.map((step, index) => {
                const translateY = stepsAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12 + index * 3, 0],
                });

                return (
                  <Animated.View
                    key={step.title}
                    style={[
                      styles.stepCard,
                      isWide && styles.stepCardWide,
                      {
                        opacity: stepsAnim,
                        transform: [{ translateY }],
                      },
                    ]}
                  >
                    <View style={styles.stepIcon}>
                      <Ionicons name={step.icon as any} size={18} color={BRAND_PRIMARY} />
                    </View>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                  </Animated.View>
                );
              })}
            </View>
          </View>

          <View style={styles.complianceSection}>
            <Text style={styles.complianceTitle}>Compliance</Text>
            <Text style={styles.complianceBody}>
              {jurisdictionLabel}. {jurisdictionDisclaimer} Not investment advice.
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerBrand}>Anymarkt</Text>
            <Text style={styles.footerCopy}>© {new Date().getFullYear()} · 17+</Text>
            <WhatsAppContactLink style={styles.footerWhatsApp} />
            <View style={styles.footerLinks}>
              {POLICY_ROUTE_ORDER.map((kind) => {
                const doc = policyDocuments[kind];
                return (
                  <TouchableOpacity
                    key={kind}
                    onPress={() => router.push(policyRouteWithJurisdiction(doc.route, launchJurisdiction) as any)}
                    style={[styles.footerLinkButton, Platform.OS === 'web' && ({ cursor: 'pointer' } as any)]}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.footerLink}>{doc.title}</Text>
                  </TouchableOpacity>
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
    backgroundColor: BRAND_DARK_BG,
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
  },
  glowOne: {
    position: 'absolute',
    top: -150,
    right: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(79, 70, 229, 0.12)', // Indigo
  },
  glowTwo: {
    position: 'absolute',
    bottom: -150,
    left: -100,
    width: 500,
    height: 500,
    borderRadius: 250,
    backgroundColor: 'rgba(16, 185, 129, 0.06)', // Emerald
  },
  glowThree: {
    position: 'absolute',
    top: '40%',
    left: '25%',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(59, 130, 246, 0.08)', // Blue
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
    marginBottom: 16,
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
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: BRAND_DARK_BORDER,
  },
  navButtonText: {
    color: '#F3F4F6',
    fontSize: 14,
    fontWeight: '500',
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
    flex: 1.1,
    maxWidth: 580,
  },
  betaPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(79, 70, 229, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.3)',
  },
  betaPillText: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '300',
    letterSpacing: -1.5,
    maxWidth: 720,
  },
  titleWide: {
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -2,
  },
  titleCompact: {
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: -1.2,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    maxWidth: 520,
  },
  betaSubtitle: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
    maxWidth: 520,
  },
  ctaBlock: {
    gap: 10,
    paddingTop: 4,
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
    borderRadius: 14,
    minWidth: 148,
    height: 52,
    paddingHorizontal: 22,
    backgroundColor: BRAND_PRIMARY,
    ...Platform.select({
      web: {
        boxShadow: '0px 10px 16px rgba(59, 130, 246, 0.25)',
      },
      default: {
        shadowColor: BRAND_PRIMARY,
        shadowOpacity: 0.25,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
        elevation: 5,
      },
    }),
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    minWidth: 112,
    height: 52,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: BRAND_DARK_BORDER,
  },
  secondaryButtonText: {
    color: '#F3F4F6',
    fontSize: 15,
    fontWeight: '500',
  },
  ctaHelper: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 18,
  },
  secondaryCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  ctaHelperSecondary: {
    color: TEXT_MUTED,
    fontSize: 13,
  },
  trustLine: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.15,
    marginTop: 4,
  },
  visualPanel: {
    height: 540,
    gap: 12,
  },
  visualPanelWide: {
    flex: 0.9,
    height: 600,
  },
  visualPanelCompact: {
    height: 540,
    borderRadius: 24,
  },
  mockDeviceFrame: {
    flex: 1,
    borderRadius: 36,
    borderWidth: 6,
    borderColor: '#1E293B', // Phone body
    backgroundColor: '#0B0F19', // Dark background
    overflow: 'hidden',
    padding: 16,
    gap: 12,
    ...Platform.select({
      web: {
        boxShadow: '0px 25px 50px -12px rgba(0, 0, 0, 0.5)',
      },
      default: {
        shadowColor: '#000000',
        shadowOpacity: 0.5,
        shadowRadius: 25,
        shadowOffset: { width: 0, height: 20 },
        elevation: 10,
      },
    }),
  },
  mockStatusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  mockStatusBarTime: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '400',
  },
  mockStatusBarIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mockAppHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
  },
  mockAppHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mockGroupAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BRAND_ACCENT_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockGroupAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '400',
  },
  mockGroupName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '400',
  },
  mockGroupMembers: {
    color: '#64748B',
    fontSize: 11,
  },
  mockWalletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  mockWalletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND_EMERALD,
  },
  mockWalletText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '400',
  },
  marketTicket: {
    borderRadius: 20,
    padding: 16,
    gap: 10,
    backgroundColor: 'rgba(17, 24, 39, 0.8)',
    borderWidth: 1,
    borderColor: BRAND_DARK_BORDER,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND_EMERALD,
  },
  liveText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '400',
  },
  marketQuestion: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  optionsList: {
    gap: 6,
  },
  optionRow: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionRowLead: {
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.25)',
  },
  optionTextWrap: {
    width: 110,
  },
  optionLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  optionLabelLead: {
    color: '#FFFFFF',
  },
  optionNote: {
    color: '#818CF8',
    fontSize: 9,
    fontWeight: '500',
    marginTop: 1,
  },
  optionMeterTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  optionMeterFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: BRAND_PRIMARY,
  },
  optionChance: {
    width: 36,
    textAlign: 'right',
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
  },
  optionChanceLead: {
    color: '#FFFFFF',
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: BRAND_DARK_BORDER,
    paddingTop: 10,
  },
  closeTime: {
    flex: 1,
    color: '#64748B',
    fontSize: 11,
  },
  favoriteLabel: {
    color: BRAND_PRIMARY,
    fontSize: 11,
    fontWeight: '500',
  },
  mockChatSection: {
    gap: 8,
  },
  mockChatHeader: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    paddingLeft: 4,
  },
  mockChatList: {
    gap: 6,
  },
  mockChatBubble: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignSelf: 'flex-start',
    maxWidth: '90%',
  },
  mockChatBubbleBet: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.15)',
  },
  mockChatUser: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '400',
    marginBottom: 1,
  },
  mockChatUserBet: {
    color: '#34D399',
  },
  mockChatText: {
    color: '#E2E8F0',
    fontSize: 11,
    lineHeight: 14,
  },
  mockChatTextBet: {
    color: '#A7F3D0',
    fontWeight: '500',
  },
  stepsSection: {
    paddingBottom: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: BRAND_DARK_BORDER,
    gap: 10,
  },
  stepsTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: -0.3,
  },
  stepsHint: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 18,
  },
  stepsGraph: {
    gap: 8,
  },
  stepsGraphWide: {
    flexDirection: 'row',
    gap: 10,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: BRAND_DARK_BORDER,
  },
  stepCardWide: {
    flex: 1,
    justifyContent: 'center',
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  stepTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 640,
  },
  accessSection: {
    paddingBottom: 24,
    paddingTop: 8,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: BRAND_DARK_BORDER,
  },
  accessSteps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  accessInlineItem: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '500',
  },
  accessDivider: {
    color: TEXT_MUTED,
    fontSize: 14,
  },
  footerWhatsApp: {
    paddingTop: 2,
  },
  complianceSection: {
    paddingBottom: 24,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: BRAND_DARK_BORDER,
    paddingTop: 24,
  },
  complianceTitle: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '400',
  },
  complianceBody: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 720,
  },
  footer: {
    paddingTop: 24,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: BRAND_DARK_BORDER,
    gap: 10,
  },
  footerBrand: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  footerCopy: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 20,
  },
  footerLinks: {
    gap: 8,
    paddingTop: 6,
  },
  footerLinkButton: {
    alignSelf: 'flex-start',
  },
  footerLink: {
    color: TEXT_LINK,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
