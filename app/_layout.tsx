import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';

import { AnyMarketLoader } from '@/components/AnyMarketLoader';
import { PremiumNavigationProvider } from '@/components/PremiumNavigationProvider';
import { SEO } from '@/components/SEO';
import { SignupBanner } from '@/components/SignupBanner';
import { WebContainer } from '@/components/WebContainer';
import { AuthProvider, useAuthContext } from '@/contexts/AuthContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { WalletProvider } from '@/contexts/WalletContext';
import { StripeProvider } from '@/lib/stripe-bridge';
import { groupService } from '@/services/group.service';

export const unstable_settings = {
  initialRouteName: 'index',
};

const PENDING_WEB_INVITE_KEY = 'anymarket:pending-web-invite';

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

function RootLayoutNav() {
  const { user, loading } = useAuthContext();
  const { isDark, theme } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const currentSegment = segments[0];
  const tabSegment = segments[1];
  const hasPageLevelSeo =
    currentSegment === undefined ||
    currentSegment === 'market' ||
    currentSegment === 'profile' ||
    tabSegment === 'feed' ||
    tabSegment === 'profile';
  const initialUrlHandled = useRef(false);
  const pendingDeepLink = useRef<string | null>(null);
  const consumingInvite = useRef(false);

  // Handle deep links
  useEffect(() => {
    // Parse URL and navigate to appropriate screen
    const handleDeepLink = (url: string) => {
      try {
        const parsed = Linking.parse(url);
        console.log('[DeepLink] Parsed URL:', parsed);
        const inviteIntent = parseInviteIntent(url);

        if (inviteIntent && !user) {
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
      if (!loading && user) {
        handleDeepLink(event.url);
      } else {
        pendingDeepLink.current = event.url;
      }
    });

    getInitialUrl();

    return () => {
      subscription.remove();
    };
  }, [router, loading, user]);

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

          if (inviteIntent && !user) {
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
  }, [loading, router, user]);

  useEffect(() => {
    if (loading || !user || consumingInvite.current) return;

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
  }, [loading, router, user]);

  useEffect(() => {
    if (loading) return;

    const segment = segments[0];
    const isLanding = segment === undefined;
    const isLogin = segment === 'login';
    const inviteIntent = getCurrentWebInviteIntent();
    const hasPendingInvite = Boolean(readPendingWebInvite());
    const isPublicRoute = isLanding || isLogin || segment === 'market' || segment === 'profile';

    if (!user && inviteIntent) {
      storePendingWebInvite(inviteIntent);
      router.replace('/login?mode=signup' as any);
      return;
    }

    if (user && hasPendingInvite) {
      return;
    }

    if (!user && !isPublicRoute) {
      // Redirect to landing if not authenticated and not a public route
      router.replace('/');
    } else if (user && (isLanding || isLogin)) {
      // Redirect authenticated users into the main app
      router.replace('/(tabs)');
    }
  }, [user, loading, segments, router]);

  if (loading) {
    return <AnyMarketLoader message="Preparing AnyMarket..." />;
  }

  return (
    <NavThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <PremiumNavigationProvider>
        {!user && currentSegment !== undefined && currentSegment !== 'login' && <SignupBanner />}
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
          <Stack.Screen name="group/[id]" />
          <Stack.Screen name="market/[id]" />
          <Stack.Screen name="bet/[id]" />
          <Stack.Screen name="profile/[id]" />
          <Stack.Screen name="topup" options={{ animation: Platform.OS === 'web' ? 'fade' : 'slide_from_bottom' }} />
        </Stack>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </PremiumNavigationProvider>
    </NavThemeProvider>
  );
}

/** Matches `app/index.tsx` landing root so wide-web gutters are not theme.dark while the page is light. */
const LANDING_PAGE_BACKGROUND = '#F5F7FB';

function WebShell({ children }: { children: React.ReactNode }) {
  const segments = useSegments();
  const isLanding = segments[0] === undefined;
  const shellBackgroundColor =
    Platform.OS === 'web' && isLanding ? LANDING_PAGE_BACKGROUND : undefined;

  return (
    <WebContainer shellBackgroundColor={shellBackgroundColor}>
      {children}
    </WebContainer>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <WebShell>
        <AuthProvider>
          <WalletProvider>
            <StripeProvider publishableKey ={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''}>
              <RootLayoutNav />
            </StripeProvider>
          </WalletProvider>
        </AuthProvider>
      </WebShell>
    </ThemeProvider>
  );
}
