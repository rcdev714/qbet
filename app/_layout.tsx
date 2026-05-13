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

export const unstable_settings = {
  initialRouteName: 'index',
};

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

  // Handle deep links
  useEffect(() => {
    // Parse URL and navigate to appropriate screen
    const handleDeepLink = (url: string) => {
      try {
        const parsed = Linking.parse(url);
        console.log('[DeepLink] Parsed URL:', parsed);

        // Handle market deep links: qbet://market/{id} or /share/market/{id}
        if (parsed.path?.startsWith('market/') || parsed.path?.startsWith('share/market/')) {
          const marketId = parsed.path
            .replace('share/market/', '')
            .replace('market/', '');
          if (marketId) {
            console.log('[DeepLink] Navigating to market:', marketId);
            const groupId = parsed.queryParams?.group;
            router.push(groupId
              ? ({ pathname: '/market/[id]', params: { id: marketId, group: String(groupId) } } as any)
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
            router.push(`/group/${groupId}` as any);
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
          if (parsed.path?.startsWith('market/') || parsed.path?.startsWith('share/market/')) {
            const marketId = parsed.path
              .replace('share/market/', '')
              .replace('market/', '');
            if (marketId) {
              const groupId = parsed.queryParams?.group;
              router.push(groupId
                ? ({ pathname: '/market/[id]', params: { id: marketId, group: String(groupId) } } as any)
                : (`/market/${marketId}` as any));
            }
          } else if (parsed.path?.startsWith('group/') || parsed.path?.startsWith('share/group/')) {
            const groupId = parsed.path
              .replace('share/group/', '')
              .replace('group/', '');
            if (groupId) {
              router.push(`/group/${groupId}` as any);
            }
          }
        } catch (error) {
          console.error('[DeepLink] Error handling pending URL:', error);
        }
      }, 100);
    }
  }, [loading, router]);

  useEffect(() => {
    if (loading) return;

    const segment = segments[0];
    const isLanding = segment === undefined;
    const isLogin = segment === 'login';
    const isPublicRoute = isLanding || isLogin || segment === 'market' || segment === 'profile';

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
