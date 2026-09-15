import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import '@/lib/sentry-init';

import { AnymarktLoader } from '@/components/AnymarktLoader';
import { ClientOnlyWebApp } from '@/components/ClientOnlyWebApp';
import { PremiumNavigationProvider } from '@/components/PremiumNavigationProvider';
import { SEO } from '@/components/SEO';
import { SignupBanner } from '@/components/SignupBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { WebContainer } from '@/components/WebContainer';
import { AuthProvider, useAuthContext } from '@/contexts/AuthContext';
import { SocialFollowProvider } from '@/contexts/SocialFollowContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { NavigationLayoutProvider } from '@/contexts/NavigationLayoutContext';
import { OnboardingGuardProvider } from '@/contexts/OnboardingGuardContext';
import { PolicyFrameworkProvider } from '@/contexts/PolicyFrameworkContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { WalletProvider } from '@/contexts/WalletContext';
import { isAppAdmin } from '@/lib/admin';
import { LEGAL_COLORS, LEGAL_STACK_SCREEN_OPTIONS } from '@/lib/legal/typography';
import { getPublicEnv } from '@/lib/public-env';
import { Sentry } from '@/lib/sentry';
import { StripeProvider } from '@/lib/stripe-bridge';
import { shouldShowBootstrapLoader } from '@/lib/web-client-mount.logic';
import { complianceService } from '@/services/compliance.service';
import { groupService } from '@/services/group.service';

export const unstable_settings = {
  initialRouteName: 'index',
};

const PENDING_WEB_INVITE_KEY = 'anymarket:pending-web-invite';
const ONBOARDING_CHECK_TIMEOUT_MS = 12_000;
const POST_AUTH_HOME = '/(tabs)/feed' as const;

async function resolveBetaAccess(
  userId: string,
  user: { email?: string | null; is_admin?: boolean | null } | null,
): Promise<boolean> {
  if (getPublicEnv().betaRequired !== 'true') return true;
  if (isAppAdmin(user)) return true;
  return complianceService.hasBetaAccess(userId);
}

type PendingWebInvite = {
  inviteCode: string;
  groupId: string;
  marketId?: string;
  target: 'group' | 'market';
  createdAt: number;
};

function getQueryParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseInviteIntent(url: string): PendingWebInvite | null {
  try {
    const parsed = Linking.parse(url);
    const path = parsed.path ?? '';
    const inviteCode = getQueryParam(parsed.queryParams?.invite);
    const groupParam = getQueryParam(parsed.queryParams?.group);

    if (!inviteCode) return null;

    if (path.startsWith('share/group/') || path.startsWith('group/')) {
      const groupId = path
        .replace('share/group/', '')
        .replace('group/', '');

      if (!groupId) return null;

      return {
        inviteCode,
        groupId,
        target: 'group',
        createdAt: Date.now(),
      };
    }

    if ((path.startsWith('share/market/') || path.startsWith('market/')) && groupParam) {
      const marketId = path
        .replace('share/market/', '')
        .replace('market/', '');

      if (!marketId) return null;

      return {
        inviteCode,
        groupId: groupParam,
        marketId,
        target: 'market',
        createdAt: Date.now(),
      };
    }
  } catch (error) {
    console.error('[InviteLink] Error parsing invite URL:', error);
  }

  return null;
}

function getCurrentWebInviteIntent() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return parseInviteIntent(window.location.href);
}

function storePendingWebInvite(invite: PendingWebInvite) {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(PENDING_WEB_INVITE_KEY, JSON.stringify(invite));
}

function readPendingWebInvite() {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return null;

  try {
    const raw = sessionStorage.getItem(PENDING_WEB_INVITE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PendingWebInvite;
    if (!parsed.inviteCode || !parsed.groupId) return null;

    return parsed;
  } catch (error) {
    console.error('[InviteLink] Error reading pending invite:', error);
    return null;
  }
}

function clearPendingWebInvite() {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(PENDING_WEB_INVITE_KEY);
}

function isLandingSegment(segment: string | undefined) {
  return segment === undefined || segment === 'index';
}

const LEGAL_SEGMENTS = new Set([
  'terms',
  'privacy',
  'risk',
  'market-rules',
  'aml-kyc',
  'prohibited-markets',
]);

function isLegalSegment(segment: string | undefined) {
  return segment != null && LEGAL_SEGMENTS.has(segment);
}

function isPublicSegment(segment: string | undefined) {
  return (
    isLandingSegment(segment) ||
    segment === 'login' ||
    segment === 'auth' ||
    segment === 'request-access' ||
    segment === 'beta' ||
    segment === 'market' ||
    segment === 'profile' ||
    segment === 'share' ||
    segment === 'onboarding' ||
    segment === 'how-it-works' ||
    isLegalSegment(segment)
  );
}

function isAdminSegment(segment: string | undefined, segments: string[]) {
  if (segment === 'admin-dashboard') return true;
  if (segment === 'admin' && ['users', 'transactions', 'reports'].includes(segments[1] ?? '')) {
    return true;
  }
  return false;
}

function RootLayoutNav() {
  const { hasSession, loading, user } = useAuthContext();
  const { isDark, theme } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const currentSegment = segments[0];
  const tabSegment = (segments as string[])[1];
  const isLanding = isLandingSegment(currentSegment);
  const [policyCheckDone, setPolicyCheckDone] = useState(!hasSession);
  const [hasPolicyAcceptances, setHasPolicyAcceptances] = useState(true);
  const [hasResidence, setHasResidence] = useState(true);
  const [hasBetaAccess, setHasBetaAccess] = useState(true);
  const hasPageLevelSeo =
    isLanding ||
    currentSegment === 'market' ||
    currentSegment === 'profile' ||
    tabSegment === 'feed' ||
    tabSegment === 'profile' ||
    isLegalSegment(currentSegment);
  const initialUrlHandled = useRef(false);
  const pendingDeepLink = useRef<string | null>(null);
  const consumingInvite = useRef(false);
  const onboardingSnapshotRef = useRef({
    hasResidence: true,
    hasPolicyAcceptances: true,
    hasBetaAccess: true,
  });

  const refreshOnboardingStatus = useCallback(async () => {
    if (!hasSession || !user?.id) return;

    const betaRequired = getPublicEnv().betaRequired === 'true';

    try {
      const residenceSet = await complianceService.hasSetResidence(user.id);
      const accepted = residenceSet
        ? await complianceService.hasAcceptedCurrentPolicies(user.id)
        : false;
      const betaAccess = betaRequired
        ? await resolveBetaAccess(user.id, user)
        : true;

      onboardingSnapshotRef.current = {
        hasResidence: residenceSet,
        hasPolicyAcceptances: accepted,
        hasBetaAccess: betaAccess,
      };
      setHasResidence(residenceSet);
      setHasPolicyAcceptances(accepted);
      setHasBetaAccess(betaAccess);
      setPolicyCheckDone(true);
    } catch (error) {
      console.warn('[Auth] Onboarding refresh failed:', error);
      const snapshot = onboardingSnapshotRef.current;
      setHasResidence(snapshot.hasResidence);
      setHasPolicyAcceptances(snapshot.hasPolicyAcceptances);
      setHasBetaAccess(snapshot.hasBetaAccess);
      setPolicyCheckDone(true);
    }
  }, [hasSession, user]);

  useLayoutEffect(() => {
    if (loading) return;
    if (!hasSession) {
      setPolicyCheckDone(true);
      setHasPolicyAcceptances(true);
      setHasResidence(true);
      setHasBetaAccess(true);
      onboardingSnapshotRef.current = {
        hasResidence: true,
        hasPolicyAcceptances: true,
        hasBetaAccess: true,
      };
      return;
    }
    setPolicyCheckDone(false);
  }, [loading, hasSession]);

  useEffect(() => {
    if (loading || !hasSession || !user?.id) return;

    let mounted = true;
    const betaRequired = getPublicEnv().betaRequired === 'true';
    const timeoutId = setTimeout(() => {
      if (!mounted) return;
      console.warn('[Auth] Onboarding check timed out; using last-known-good flags');
      const snapshot = onboardingSnapshotRef.current;
      setHasResidence(snapshot.hasResidence);
      setHasPolicyAcceptances(snapshot.hasPolicyAcceptances);
      setHasBetaAccess(snapshot.hasBetaAccess);
      setPolicyCheckDone(true);
    }, ONBOARDING_CHECK_TIMEOUT_MS);

    const verifyOnboarding = async () => {
      try {
        const residenceSet = await complianceService.hasSetResidence(user?.id);
        const [accepted, betaAccess] = await Promise.all([
          residenceSet
            ? complianceService.hasAcceptedCurrentPolicies(user?.id)
            : Promise.resolve(false),
          betaRequired
            ? resolveBetaAccess(user.id, user)
            : Promise.resolve(true),
        ]);

        if (mounted) {
          clearTimeout(timeoutId);
          onboardingSnapshotRef.current = {
            hasResidence: residenceSet,
            hasPolicyAcceptances: accepted,
            hasBetaAccess: betaAccess,
          };
          setHasResidence(residenceSet);
          setHasPolicyAcceptances(accepted);
          setHasBetaAccess(betaAccess);
          setPolicyCheckDone(true);
        }
      } catch (error) {
        console.warn('[Auth] Onboarding check failed:', error);
        if (mounted) {
          clearTimeout(timeoutId);
          const snapshot = onboardingSnapshotRef.current;
          setHasResidence(snapshot.hasResidence);
          setHasPolicyAcceptances(snapshot.hasPolicyAcceptances);
          setHasBetaAccess(snapshot.hasBetaAccess);
          setPolicyCheckDone(true);
        }
      }
    };

    void verifyOnboarding();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [loading, hasSession, user]);

  // Handle deep links
  useEffect(() => {
    // Parse URL and navigate to appropriate screen
    const handleDeepLink = (url: string) => {
      try {
        const parsed = Linking.parse(url);
        console.log('[DeepLink] Parsed URL:', parsed);
        const inviteIntent = parseInviteIntent(url);

        if (inviteIntent && !hasSession) {
          storePendingWebInvite(inviteIntent);
          router.replace('/login?mode=signup' as any);
          return true;
        }

        // Handle market deep links: qbet://market/{id} or /share/market/{id}
        if (parsed.path?.startsWith('market/') || parsed.path?.startsWith('share/market/')) {
          const marketId = parsed.path
            .replace('share/market/', '')
            .replace('market/', '');
          if (marketId) {
            console.log('[DeepLink] Navigating to market:', marketId);
            const groupId = parsed.queryParams?.group;
            const inviteCode = parsed.queryParams?.invite;
            router.push(groupId
              ? ({ pathname: '/market/[id]', params: { id: marketId, group: String(groupId), invite: inviteCode ? String(inviteCode) : undefined } } as any)
              : (`/market/${marketId}` as any));
            return true;
          }
        }

        // Handle group deep links: qbet://group/{id} or /share/group/{id}
        if (parsed.path?.startsWith('group/') || parsed.path?.startsWith('share/group/')) {
          const groupId = parsed.path
            .replace('share/group/', '')
            .replace('group/', '');
          if (groupId) {
            console.log('[DeepLink] Navigating to group:', groupId);
            const inviteCode = parsed.queryParams?.invite;
            router.push(inviteCode
              ? ({ pathname: '/group/[id]', params: { id: groupId, invite: String(inviteCode) } } as any)
              : (`/group/${groupId}` as any));
            return true;
          }
        }

        return false;
      } catch (error) {
        console.error('[DeepLink] Error parsing URL:', error);
        return false;
      }
    };

    // Get initial URL (cold start)
    const getInitialUrl = async () => {
      if (initialUrlHandled.current) return;
      
      try {
        const url = await Linking.getInitialURL();
        if (url) {
          console.log('[DeepLink] Initial URL:', url);
          // Store pending deep link if user not loaded yet
          if (loading) {
            pendingDeepLink.current = url;
          } else {
            initialUrlHandled.current = true;
            handleDeepLink(url);
          }
        }
      } catch (error) {
        console.error('[DeepLink] Error getting initial URL:', error);
      }
    };

    // Handle URL events (app already open)
    const subscription = Linking.addEventListener('url', (event) => {
      console.log('[DeepLink] URL event:', event.url);
      if (!loading && hasSession) {
        handleDeepLink(event.url);
      } else {
        pendingDeepLink.current = event.url;
      }
    });

    getInitialUrl();

    return () => {
      subscription.remove();
    };
  }, [router, loading, hasSession]);

  // Handle pending deep link after auth loads
  useEffect(() => {
    if (!loading && pendingDeepLink.current && !initialUrlHandled.current) {
      initialUrlHandled.current = true;
      const url = pendingDeepLink.current;
      pendingDeepLink.current = null;
      
      // Small delay to ensure navigation is ready
      setTimeout(() => {
        try {
          const parsed = Linking.parse(url);
          const inviteIntent = parseInviteIntent(url);

          if (inviteIntent && !hasSession) {
            storePendingWebInvite(inviteIntent);
            router.replace('/login?mode=signup' as any);
            return;
          }

          if (parsed.path?.startsWith('market/') || parsed.path?.startsWith('share/market/')) {
            const marketId = parsed.path
              .replace('share/market/', '')
              .replace('market/', '');
            if (marketId) {
              const groupId = parsed.queryParams?.group;
              const inviteCode = parsed.queryParams?.invite;
              router.push(groupId
                ? ({ pathname: '/market/[id]', params: { id: marketId, group: String(groupId), invite: inviteCode ? String(inviteCode) : undefined } } as any)
                : (`/market/${marketId}` as any));
            }
          } else if (parsed.path?.startsWith('group/') || parsed.path?.startsWith('share/group/')) {
            const groupId = parsed.path
              .replace('share/group/', '')
              .replace('group/', '');
            if (groupId) {
              const inviteCode = parsed.queryParams?.invite;
              router.push(inviteCode
                ? ({ pathname: '/group/[id]', params: { id: groupId, invite: String(inviteCode) } } as any)
                : (`/group/${groupId}` as any));
            }
          }
        } catch (error) {
          console.error('[DeepLink] Error handling pending URL:', error);
        }
      }, 100);
    }
  }, [loading, router, hasSession]);

  useEffect(() => {
    if (loading || !hasSession || consumingInvite.current) return;

    const pendingInvite = readPendingWebInvite();
    if (!pendingInvite) return;

    consumingInvite.current = true;

    const consumeInvite = async () => {
      try {
        const { error } = await groupService.joinGroupByCode(pendingInvite.inviteCode);
        if (error) {
          console.warn('[InviteLink] Failed to auto-join group:', error.message);
        }
      } finally {
        clearPendingWebInvite();
        consumingInvite.current = false;

        if (pendingInvite.target === 'market' && pendingInvite.marketId) {
          router.replace({
            pathname: '/market/[id]',
            params: { id: pendingInvite.marketId, group: pendingInvite.groupId },
          } as any);
        } else {
          router.replace(`/group/${pendingInvite.groupId}` as any);
        }
      }
    };

    consumeInvite();
  }, [loading, router, hasSession]);

  useEffect(() => {
    if (loading || !hasSession || !user?.id || hasBetaAccess) return;

    const segment = segments[0];
    const onboardingSegment = (segments as string[])[1];
    const isBetaWaitlist = segment === 'onboarding' && onboardingSegment === 'beta-waitlist';
    if (!isBetaWaitlist) return;

    const interval = setInterval(() => {
      void refreshOnboardingStatus();
    }, 30_000);

    return () => clearInterval(interval);
  }, [loading, hasSession, user?.id, hasBetaAccess, segments, refreshOnboardingStatus]);

  useEffect(() => {
    if (loading || !policyCheckDone || (hasSession && !user?.id)) return;

    const segment = segments[0];
    const isLanding = isLandingSegment(segment);
    const isLogin = segment === 'login';
    const onboardingSegment = (segments as string[])[1];
    const isPolicyOnboarding = segment === 'onboarding' && onboardingSegment === 'policies';
    const isResidenceOnboarding = segment === 'onboarding' && (onboardingSegment === 'residence' || !onboardingSegment);
    const isBetaWaitlist = segment === 'onboarding' && onboardingSegment === 'beta-waitlist';
    const isRequestAccess = segment === 'request-access';
    const isWalletVerify = segment === 'wallet' && (segments as string[])[1] === 'verify';
    const isAuthenticated = hasSession;
    const inviteIntent = getCurrentWebInviteIntent();
    const hasPendingInvite = Boolean(readPendingWebInvite());
    const isPublicRoute = isPublicSegment(segment);
    const isAdminRoute = isAdminSegment(segment, segments as string[]);
    const adminBypassOnboarding = isAuthenticated && isAppAdmin(user) && isAdminRoute;
    const canBrowseWhileOnboarding =
      isLegalSegment(segment) ||
      isPolicyOnboarding ||
      isResidenceOnboarding ||
      isBetaWaitlist ||
      isRequestAccess ||
      isWalletVerify ||
      segment === 'share' ||
      segment === 'group' ||
      segment === 'market' ||
      segment === 'bet' ||
      segment === 'contract' ||
      segment === 'notifications' ||
      segment === 'discover' ||
      adminBypassOnboarding;

    if (!isAuthenticated && inviteIntent) {
      storePendingWebInvite(inviteIntent);
      router.replace('/login?mode=signup' as any);
      return;
    }

    if (isAuthenticated && hasPendingInvite) {
      return;
    }

    if (isAuthenticated && hasBetaAccess && isBetaWaitlist) {
      router.replace('/onboarding/residence' as any);
      return;
    }

    if (isAuthenticated && getPublicEnv().betaRequired === 'true' && !hasBetaAccess && !isBetaWaitlist) {
      router.replace('/onboarding/beta-waitlist' as any);
      return;
    }

    if (isAuthenticated && !hasResidence && !canBrowseWhileOnboarding) {
      router.replace('/onboarding/residence' as any);
      return;
    }

    if (isAuthenticated && hasResidence && !hasPolicyAcceptances && !canBrowseWhileOnboarding) {
      router.replace('/onboarding/policies' as any);
      return;
    }

    if (isAuthenticated && hasResidence && hasPolicyAcceptances && (isPolicyOnboarding || isResidenceOnboarding)) {
      router.replace(POST_AUTH_HOME as any);
      return;
    }

    if (!isAuthenticated && !isPublicRoute) {
      router.replace('/');
    } else if (isAuthenticated && hasResidence && hasPolicyAcceptances && (isLanding || isLogin)) {
      router.replace(POST_AUTH_HOME as any);
    }
  }, [hasSession, loading, segments, router, policyCheckDone, hasPolicyAcceptances, hasResidence, hasBetaAccess, user?.id, user]);

  const showBootstrapLoader = shouldShowBootstrapLoader({
    loading,
    hasSession,
    policyCheckDone,
    userId: user?.id,
  });

  return (
    <NavThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <OnboardingGuardProvider refreshOnboardingStatus={refreshOnboardingStatus}>
      <PremiumNavigationProvider>
        {!hasSession && !isLanding && currentSegment !== 'login' && !isLegalSegment(currentSegment) && <SignupBanner />}
        {!hasPageLevelSeo && <SEO />}
        <Stack
          screenOptions={{
            headerShown: false,
            animation: Platform.OS === 'web' ? 'fade' : 'slide_from_right',
            animationDuration: 240,
            contentStyle: { backgroundColor: theme.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="login" />
          <Stack.Screen name="auth/reset-password" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="discover" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="request-access" />
          <Stack.Screen name="beta/welcome" />
          <Stack.Screen name="admin-dashboard" />
          <Stack.Screen name="admin/users" />
          <Stack.Screen name="admin/transactions" />
          <Stack.Screen name="admin/reports" />
          <Stack.Screen name="how-it-works" />
          <Stack.Screen name="contract/[betId]" />
          <Stack.Screen name="terms" options={LEGAL_STACK_SCREEN_OPTIONS} />
          <Stack.Screen name="privacy" options={LEGAL_STACK_SCREEN_OPTIONS} />
          <Stack.Screen name="risk" options={LEGAL_STACK_SCREEN_OPTIONS} />
          <Stack.Screen name="market-rules" options={LEGAL_STACK_SCREEN_OPTIONS} />
          <Stack.Screen name="aml-kyc" options={LEGAL_STACK_SCREEN_OPTIONS} />
          <Stack.Screen name="prohibited-markets" options={LEGAL_STACK_SCREEN_OPTIONS} />
          <Stack.Screen name="onboarding/residence" />
          <Stack.Screen name="onboarding/policies" />
          <Stack.Screen name="onboarding/beta-waitlist" />
          <Stack.Screen name="wallet/verify" />
          <Stack.Screen name="group/[id]" />
          <Stack.Screen name="market/[id]" />
          <Stack.Screen name="bet/[id]" />
          <Stack.Screen name="profile/[id]" />
          <Stack.Screen name="topup" options={{ animation: Platform.OS === 'web' ? 'fade' : 'slide_from_bottom' }} />
        </Stack>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {showBootstrapLoader ? (
          <View style={[styles.bootstrapLoaderOverlay, { pointerEvents: 'auto' }]}>
            <AnymarktLoader message="Preparing Anymarkt..." />
          </View>
        ) : null}
      </PremiumNavigationProvider>
      </OnboardingGuardProvider>
    </NavThemeProvider>
  );
}

const styles = StyleSheet.create({
  bootstrapLoaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
});

/** Matches `app/index.tsx` landing root so wide-web gutters align with the hero. */
const LANDING_PAGE_BACKGROUND = '#030712';

function WebShell({ children }: { children: React.ReactNode }) {
  const segments = useSegments();
  const segment = segments[0];
  const useLegalBackground = Platform.OS === 'web' && isLegalSegment(segment);
  const useLandingBackground = Platform.OS === 'web' && isLandingSegment(segment);
  const shellBackgroundColor = useLegalBackground
    ? LEGAL_COLORS.pageBg
    : useLandingBackground
      ? LANDING_PAGE_BACKGROUND
      : undefined;

  return (
    <WebContainer shellBackgroundColor={shellBackgroundColor}>
      {children}
    </WebContainer>
  );
}

export default Sentry.wrap(function RootLayout() {
  return (
    <ThemeProvider>
      <Sentry.ErrorBoundary
        fallback={({ resetError }) => (
          <EmptyState
            variant="destructive"
            icon="warning-outline"
            title="Something went wrong"
            description="An unexpected error occurred."
            actionLabel="Try again"
            onAction={resetError}
          />
        )}
      >
        <ClientOnlyWebApp>
          <WebShell>
            <AuthProvider>
              <SocialFollowProvider>
              <LocaleProvider>
                <PolicyFrameworkProvider>
                <WalletProvider>
                  <NavigationLayoutProvider>
                    <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''}>
                      <RootLayoutNav />
                    </StripeProvider>
                  </NavigationLayoutProvider>
                </WalletProvider>
                </PolicyFrameworkProvider>
              </LocaleProvider>
              </SocialFollowProvider>
            </AuthProvider>
          </WebShell>
        </ClientOnlyWebApp>
      </Sentry.ErrorBoundary>
    </ThemeProvider>
  );
});
