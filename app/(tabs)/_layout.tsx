import { BottomTabBar, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import {
    DESKTOP_BREAKPOINT,
    SIDEBAR_WIDTH_COLLAPSED,
    SIDEBAR_WIDTH_EXPANDED
} from '@/constants/layout';
import { useAuthContext } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { isAppAdmin } from '@/lib/admin';
import { useTranslation } from 'react-i18next';

const ICON_SIZE = Platform.OS === 'ios' ? 22 : 32;
const AVATAR_SIZE = Platform.OS === 'ios' ? 22 : 32;

function DesktopSidebarTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme: colors } = useTheme();
  const { user } = useAuthContext();
  const router = useRouter();
  const { t } = useTranslation('tabs');
  const isAdmin = isAppAdmin(user);
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  const renderIcon = (routeName: string, color: string) => {
    if (routeName === 'profile') {
      if (user?.avatar_url) {
        return <Image source={{ uri: user.avatar_url }} style={styles.sidebarAvatar} contentFit="cover" transition={200} />;
      }
      return (
        <View style={[styles.sidebarAvatarFallback, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sidebarAvatarInitial, { color }]}>{user?.username ? user.username.substring(0, 1).toUpperCase() : 'U'}</Text>
        </View>
      );
    }

    const iconByRoute: Record<string, Parameters<typeof IconSymbol>[0]['name']> = {
      feed: 'house.fill',
      index: 'person.3.fill',
      wallet: 'wallet.fill',
      settings: 'gearshape',
    };

    return <IconSymbol name={iconByRoute[routeName] ?? 'list.bullet'} size={20} color={color} />;
  };

  return (
    <View
      style={[
        styles.sidebar,
        {
          width: isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
          backgroundColor: colors.background,
          borderRightColor: colors.border,
        },
      ]}>
      <View style={styles.sidebarHeader}>
        <View>
          <Text style={[styles.sidebarBrand, { color: colors.text }]}>{isCollapsed ? 'AM' : 'AnyMarket'}</Text>
          {!isCollapsed ? <Text style={[styles.sidebarSubtext, { color: colors.textSecondary }]}>Navigation</Text> : null}
        </View>
        <TouchableOpacity
          onPress={() => setIsCollapsed((current) => !current)}
          style={[styles.collapseToggle, { backgroundColor: colors.surface, borderColor: colors.border }, Platform.OS === 'web' && ({ cursor: 'pointer' } as any)]}
          activeOpacity={0.82}>
          <IconSymbol name={isCollapsed ? 'chevron.right' : 'chevron.left'} size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.sidebarSection}>
        {state.routes
          .filter((route) => ['feed', 'index', 'wallet', 'profile'].includes(route.name))
          .map((route) => {
            const routeIndex = state.routes.findIndex((r) => r.key === route.key);
            const focused = state.index === routeIndex;
            const options = descriptors[route.key]?.options;
            const color = focused ? colors.primary : colors.textSecondary;
            const label = typeof options?.title === 'string' ? options.title : route.name;

            return (
              <TouchableOpacity
                key={route.key}
                onPress={() => {
                  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) {
                    navigation.navigate(route.name, route.params);
                  }
                }}
                style={[
                  styles.sidebarItem,
                  isCollapsed && styles.sidebarItemCollapsed,
                  focused && { backgroundColor: colors.primarySoft, borderColor: colors.primary },
                  Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                ]}
                activeOpacity={0.82}>
                <View style={styles.sidebarIconWrap}>{renderIcon(route.name, color)}</View>
                {!isCollapsed ? <Text style={[styles.sidebarLabel, { color }]}>{label}</Text> : null}
              </TouchableOpacity>
            );
          })}

        {isAdmin ? (
          <TouchableOpacity
            onPress={() => router.push('/admin-dashboard')}
            style={[styles.sidebarItem, isCollapsed && styles.sidebarItemCollapsed, Platform.OS === 'web' && ({ cursor: 'pointer' } as any)]}
            activeOpacity={0.82}>
            <View style={styles.sidebarIconWrap}>
              <IconSymbol name="shield" size={20} color={colors.textSecondary} />
            </View>
            {!isCollapsed ? <Text style={[styles.sidebarLabel, { color: colors.textSecondary }]}>{t('admin')}</Text> : null}
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.sidebarFooter}>
        {state.routes
          .filter((route) => route.name === 'settings')
          .map((route) => {
            const routeIndex = state.routes.findIndex((r) => r.key === route.key);
            const focused = state.index === routeIndex;
            const color = focused ? colors.primary : colors.textSecondary;
            const label = typeof descriptors[route.key]?.options?.title === 'string' ? descriptors[route.key].options.title : 'Settings';

            return (
              <TouchableOpacity
                key={route.key}
                onPress={() => navigation.navigate(route.name)}
                style={[
                  styles.sidebarItem,
                  isCollapsed && styles.sidebarItemCollapsed,
                  focused && { backgroundColor: colors.primarySoft, borderColor: colors.primary },
                  Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                ]}
                activeOpacity={0.82}>
                <View style={styles.sidebarIconWrap}>
                  <IconSymbol name="gearshape" size={20} color={color} />
                </View>
                {!isCollapsed ? <Text style={[styles.sidebarLabel, { color }]}>{label}</Text> : null}
              </TouchableOpacity>
            );
          })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { theme: colors } = useTheme();
  const { user } = useAuthContext();
  const { t } = useTranslation('tabs');
  const { width } = useWindowDimensions();
  const isCompactWeb = Platform.OS === 'web' && width < 420;
  const isDesktopWeb = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;

  return (
    <Tabs
      tabBar={(props) => (isDesktopWeb ? <DesktopSidebarTabBar {...props} /> : <BottomTabBar {...props} />)}
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarPosition: isDesktopWeb ? 'left' : 'bottom',
        headerShown: false,
        tabBarShowLabel: !isDesktopWeb,
        tabBarLabelStyle: {
          fontSize: isCompactWeb ? 10 : 11,
          fontWeight: '600',
        },
        tabBarStyle: [
          styles.tabBarBase,
          styles.tabBarTouch,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            borderTopWidth: StyleSheet.hairlineWidth,
          },
          isDesktopWeb && styles.desktopTabBar,
          Platform.OS === 'web' && styles.webTabBar,
          isCompactWeb && styles.compactWebTabBar,
        ],
      }}>
      <Tabs.Screen
        name="feed"
        options={{
          title: t('home'),
          tabBarIcon: ({ color }: { color: string }) => <IconSymbol size={ICON_SIZE} name="house" color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: t('groups', { defaultValue: 'Groups' }),
          tabBarIcon: ({ color }: { color: string }) => <IconSymbol size={ICON_SIZE} name="person.3.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: t('wallet'),
          tabBarIcon: ({ color }: { color: string }) => <IconSymbol size={ICON_SIZE} name="wallet.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile'),
          tabBarIcon: ({ color }: { color: string }) => (
            user?.avatar_url ? (
              <Image
                source={{ uri: user.avatar_url }}
                style={styles.tabAvatarLarge}
                contentFit="cover"
                transition={200}
              />
            ) : (
               <View style={[styles.tabAvatarPlaceholderLarge, { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.border }]}>
                   <Text style={[styles.tabAvatarInitialsLarge, { color: colors.primary }]}>
                     {user?.username ? user.username.substring(0, 1).toUpperCase() : "U"}
                   </Text>
               </View>
            )
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings'),
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarBase: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  tabBarTouch: {
    height: Platform.OS === 'ios' ? 84 : 64,
    paddingBottom: Platform.OS === 'ios' ? 24 : 0,
  },
  webTabBar: {
    height: 64,
    paddingBottom: 4,
  },
  desktopTabBar: {
    width: 260,
    paddingBottom: 16,
    borderTopWidth: 0,
  },
  compactWebTabBar: {
    height: 60,
    paddingTop: 6,
    paddingBottom: 2,
  },
  tabAvatarLarge: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  tabAvatarPlaceholderLarge: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabAvatarInitialsLarge: {
    fontSize: 11,
    fontWeight: '600',
  },
  sidebar: {
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 22,
    paddingBottom: 18,
  },
  sidebarHeader: {
    marginBottom: 22,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sidebarBrand: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.25,
  },
  sidebarSubtext: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500',
  },
  sidebarSection: {
    gap: 8,
  },
  sidebarFooter: {
    marginTop: 'auto',
    gap: 8,
  },
  sidebarItem: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 10,
  },
  sidebarItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  sidebarIconWrap: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  sidebarAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  sidebarAvatarFallback: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarAvatarInitial: {
    fontSize: 10,
    fontWeight: '700',
  },
  collapseToggle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
