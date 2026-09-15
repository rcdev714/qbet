import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import { Tabs } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { PremiumDesktopSidebar, PremiumMobileTabBar } from '@/components/navigation/PremiumTabBar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DESKTOP_BREAKPOINT, MOBILE_TAB_BAR_HEIGHT, SIDEBAR_WIDTH_EXPANDED_MAX } from '@/constants/layout';
import { useAuthContext } from '@/contexts/AuthContext';
import { useNavigationLayout } from '@/contexts/NavigationLayoutContext';
import { useTheme } from '@/contexts/ThemeContext';

const ICON_SIZE = Platform.OS === 'ios' ? 22 : 32;
const AVATAR_SIZE = Platform.OS === 'ios' ? 22 : 32;

function DesktopTabBar(props: BottomTabBarProps) {
  return <PremiumDesktopSidebar {...props} />;
}

function MobileTabBar(props: BottomTabBarProps) {
  return <PremiumMobileTabBar {...props} />;
}

export default function TabLayout() {
  const { theme: colors } = useTheme();
  const { user } = useAuthContext();
  const { t } = useTranslation('tabs');
  const { width } = useWindowDimensions();
  const { sidebarWidth } = useNavigationLayout();
  const isCompactWeb = Platform.OS === 'web' && width < 420;
  const isDesktopWeb = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;

  return (
    <Tabs
      tabBar={(props) => (isDesktopWeb ? <DesktopTabBar {...props} /> : <MobileTabBar {...props} />)}
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarPosition: isDesktopWeb ? 'left' : 'bottom',
        headerShown: false,
        tabBarShowLabel: !isDesktopWeb,
        tabBarLabelStyle: {
          fontSize: isCompactWeb ? 10 : 11,
          fontWeight: '400',
        },
        tabBarStyle: [
          !isDesktopWeb && styles.tabBarBase,
          !isDesktopWeb && styles.tabBarTouch,
          {
            backgroundColor: isDesktopWeb ? colors.surface : colors.background,
            borderTopColor: colors.border,
            borderTopWidth: StyleSheet.hairlineWidth,
          },
          isDesktopWeb && styles.desktopSidebarTabBar,
          isDesktopWeb &&
            (sidebarWidth === 'auto'
              ? ({
                  width: 'fit-content',
                  maxWidth: SIDEBAR_WIDTH_EXPANDED_MAX,
                  alignSelf: 'flex-start',
                } as object)
              : { width: sidebarWidth }),
          Platform.OS === 'web' && !isDesktopWeb && styles.webTabBar,
          isCompactWeb && !isDesktopWeb && styles.compactWebTabBar,
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
        name="groups"
        options={{
          title: t('groups', { defaultValue: 'Groups' }),
          tabBarIcon: ({ color }: { color: string }) => <IconSymbol size={ICON_SIZE} name="person.3.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: t('wallet'),
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
            <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={ICON_SIZE} color={color} />
          ),
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
    height: MOBILE_TAB_BAR_HEIGHT,
    paddingBottom: Platform.OS === 'ios' ? 24 : 0,
  },
  webTabBar: {
    height: 64,
    paddingBottom: 4,
  },
  compactWebTabBar: {
    height: 60,
    paddingTop: 6,
    paddingBottom: 2,
  },
  desktopSidebarTabBar: {
    alignSelf: 'stretch',
    height: '100%',
    paddingTop: 0,
    paddingBottom: 0,
    borderTopWidth: 0,
    ...(Platform.OS === 'web' ? ({ minHeight: '100vh' } as object) : {}),
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
    fontWeight: '400',
  },
});
