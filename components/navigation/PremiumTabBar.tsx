import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { FontWeight } from '@/constants/typography';
import { useAuthContext } from '@/contexts/AuthContext';
import { useNavigationLayout } from '@/contexts/NavigationLayoutContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useWalletContext } from '@/contexts/WalletContext';
import { isAdminEmail } from '@/lib/admin';
import { formatCurrency } from '@/lib/parimutuel';

const MOBILE_ICON_SIZE = Platform.OS === 'ios' ? 22 : 24;

type SidebarRouteName = 'feed' | 'index' | 'wallet' | 'profile' | 'settings';

const DESKTOP_MAIN_ROUTES: SidebarRouteName[] = ['feed', 'index', 'wallet'];
const MOBILE_MAIN_ROUTES: SidebarRouteName[] = ['feed', 'index', 'wallet', 'profile'];

function BrandMark({ compact }: { compact?: boolean }) {
  const { theme: colors } = useTheme();

  return (
    <View
      style={[
        styles.brandMark,
        compact && styles.brandMarkCompact,
        { backgroundColor: colors.text, borderColor: colors.border },
      ]}>
      <Text style={[styles.brandMarkLetter, { color: colors.background }]}>A</Text>
    </View>
  );
}

const ROUTE_ICONS: Record<SidebarRouteName, { active: IconSymbolName; inactive: IconSymbolName }> = {
  feed: { active: 'house.fill', inactive: 'house' },
  index: { active: 'person.3.fill', inactive: 'person.3' },
  wallet: { active: 'wallet.fill', inactive: 'wallet' },
  profile: { active: 'person.fill', inactive: 'person' },
  settings: { active: 'gearshape', inactive: 'gearshape' },
};

function SidebarNavItem({
  label,
  focused,
  collapsed,
  onPress,
  icon,
  avatarUrl,
  avatarInitial,
  hint,
  badge,
}: {
  label: string;
  focused: boolean;
  collapsed: boolean;
  onPress: () => void;
  icon?: IconSymbolName;
  avatarUrl?: string | null;
  avatarInitial?: string;
  hint?: string;
  badge?: number;
}) {
  const { theme: colors } = useTheme();
  const [hovered, setHovered] = React.useState(false);
  const color = focused ? colors.primary : colors.textSecondary;

  const iconNode =
    avatarUrl || avatarInitial ? (
      avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={[styles.sidebarAvatar, focused && styles.sidebarAvatarActive]} contentFit="cover" transition={200} />
      ) : (
        <View style={[styles.sidebarAvatarFallback, { backgroundColor: colors.input, borderColor: focused ? colors.primary : colors.border }]}>
          <Text style={[styles.sidebarAvatarInitial, { color: focused ? colors.primary : colors.text }]}>{avatarInitial}</Text>
        </View>
      )
    ) : icon ? (
      <IconSymbol name={icon} size={19} color={color} />
    ) : null;

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.sidebarItem,
        collapsed && styles.sidebarItemCollapsed,
        focused && { backgroundColor: colors.primarySoft },
        !focused && hovered && Platform.OS === 'web' && ({ backgroundColor: `${colors.textSecondary}12` } as ViewStyle),
        pressed && { opacity: 0.88 },
        Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}>
      {focused ? <View style={[styles.sidebarActiveBar, { backgroundColor: colors.primary }]} /> : null}
      <View style={[styles.sidebarIconShell, focused && { backgroundColor: `${colors.primary}22` }]}>{iconNode}</View>
      {!collapsed ? (
        <>
          <Text style={[styles.sidebarLabel, { color: focused ? colors.text : colors.textSecondary }, focused && styles.sidebarLabelActive]} numberOfLines={1}>
            {label}
          </Text>
          {hint ? (
            <Text style={[styles.sidebarHint, { color: colors.textSecondary }]} numberOfLines={1}>
              {hint}
            </Text>
          ) : null}
          {badge && badge > 0 ? (
            <View style={[styles.sidebarBadge, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
              <Text style={[styles.sidebarBadgeText, { color: colors.primary }]}>{badge > 99 ? '99+' : badge}</Text>
            </View>
          ) : null}
        </>
      ) : null}
    </Pressable>
  );
}

function SidebarAccountItem({
  username,
  avatarUrl,
  focused,
  collapsed,
  onPress,
}: {
  username: string;
  avatarUrl?: string | null;
  focused: boolean;
  collapsed: boolean;
  onPress: () => void;
}) {
  const { theme: colors } = useTheme();
  const [hovered, setHovered] = React.useState(false);
  const initial = username.substring(0, 1).toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.sidebarItem,
        collapsed && styles.sidebarItemCollapsed,
        focused && { backgroundColor: colors.primarySoft },
        !focused && hovered && Platform.OS === 'web' && ({ backgroundColor: `${colors.textSecondary}12` } as ViewStyle),
        pressed && { opacity: 0.88 },
        Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={`Profile, ${username}`}>
      {focused ? <View style={[styles.sidebarActiveBar, { backgroundColor: colors.primary }]} /> : null}
      <View style={[styles.sidebarIconShell, focused && { backgroundColor: `${colors.primary}22` }]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={[styles.sidebarAvatar, focused && styles.sidebarAvatarActive]} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.sidebarAvatarFallback, { backgroundColor: colors.input, borderColor: focused ? colors.primary : colors.border }]}>
            <Text style={[styles.sidebarAvatarInitial, { color: focused ? colors.primary : colors.text }]}>{initial}</Text>
          </View>
        )}
      </View>
      {!collapsed ? (
        <>
          <Text style={[styles.sidebarLabel, { color: focused ? colors.text : colors.textSecondary }, focused && styles.sidebarLabelActive]} numberOfLines={1}>
            {username}
          </Text>
          <IconSymbol name="chevron.right" size={14} color={colors.textSecondary} />
        </>
      ) : null}
    </Pressable>
  );
}

export function PremiumDesktopSidebar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme: colors } = useTheme();
  const { user } = useAuthContext();
  const { balance } = useWalletContext();
  const router = useRouter();
  const { sidebarCollapsed, setSidebarCollapsed } = useNavigationLayout();
  const isAdmin = isAdminEmail(user?.email);
  const isAuthenticated = Boolean(user);

  const navigateRoute = (routeName: string, routeKey: string, routeParams: object | undefined, focused: boolean) => {
    const event = navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      navigation.navigate(routeName, routeParams);
    }
  };

  const renderMainRoute = (routeName: SidebarRouteName) => {
    const route = state.routes.find((r) => r.name === routeName);
    if (!route) return null;

    const routeIndex = state.routes.findIndex((r) => r.key === route.key);
    const focused = state.index === routeIndex;
    const options = descriptors[route.key]?.options;
    const label = typeof options?.title === 'string' ? options.title : route.name;
    const icons = ROUTE_ICONS[routeName];
    const walletHint =
      routeName === 'wallet' && !sidebarCollapsed && isAuthenticated
        ? formatCurrency(balance)
        : undefined;

    return (
      <SidebarNavItem
        key={route.key}
        label={label}
        focused={focused}
        collapsed={sidebarCollapsed}
        icon={focused ? icons.active : icons.inactive}
        hint={walletHint}
        onPress={() => navigateRoute(route.name, route.key, route.params, focused)}
      />
    );
  };

  const profileRoute = state.routes.find((r) => r.name === 'profile');
  const profileIndex = profileRoute ? state.routes.findIndex((r) => r.key === profileRoute.key) : -1;
  const profileFocused = profileIndex === state.index;

  const settingsRoute = state.routes.find((r) => r.name === 'settings');
  const settingsIndex = settingsRoute ? state.routes.findIndex((r) => r.key === settingsRoute.key) : -1;
  const settingsFocused = settingsIndex === state.index;

  return (
    <View style={styles.sidebar}>
      <View style={[styles.sidebarHeader, sidebarCollapsed && styles.sidebarHeaderCollapsed]}>
        <Pressable
          onPress={() => router.push('/feed')}
          style={(state) => {
            const { pressed } = state;
            const hovered = Platform.OS === 'web' && 'hovered' in state && Boolean(state.hovered);
            return [
            styles.sidebarBrandRow,
            sidebarCollapsed && styles.sidebarBrandRowCollapsed,
            hovered && ({ opacity: 0.82 } as ViewStyle),
            pressed && { opacity: 0.72 },
            Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
          ]}}
          accessibilityRole="button"
          accessibilityLabel="AnyMarket home">
          <BrandMark compact={sidebarCollapsed} />
          {!sidebarCollapsed ? (
            <Text style={[styles.sidebarBrand, { color: colors.text }]} numberOfLines={1}>
              AnyMarket
            </Text>
          ) : null}
        </Pressable>
      </View>

      <ScrollView style={styles.sidebarScroll} contentContainerStyle={styles.sidebarScrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.sidebarSection}>{DESKTOP_MAIN_ROUTES.map(renderMainRoute)}</View>
      </ScrollView>

      <View style={styles.sidebarFooter}>
        {!sidebarCollapsed ? <View style={[styles.sidebarDivider, { backgroundColor: colors.border }]} /> : null}

        {isAdmin ? (
          <SidebarNavItem
            label="Admin"
            focused={false}
            collapsed={sidebarCollapsed}
            icon="shield"
            onPress={() => router.push('/admin-dashboard')}
          />
        ) : null}

        {settingsRoute ? (
          <SidebarNavItem
            label={typeof descriptors[settingsRoute.key]?.options?.title === 'string' ? descriptors[settingsRoute.key].options.title! : 'Settings'}
            focused={settingsFocused}
            collapsed={sidebarCollapsed}
            icon={settingsFocused ? ROUTE_ICONS.settings.active : ROUTE_ICONS.settings.inactive}
            onPress={() => navigation.navigate(settingsRoute.name)}
          />
        ) : null}

        {profileRoute ? (
          user ? (
            <SidebarAccountItem
              username={user.username ?? 'Member'}
              avatarUrl={user.avatar_url}
              focused={profileFocused}
              collapsed={sidebarCollapsed}
              onPress={() => navigateRoute(profileRoute.name, profileRoute.key, profileRoute.params, profileFocused)}
            />
          ) : (
            <SidebarNavItem
              label="Sign in"
              focused={profileFocused}
              collapsed={sidebarCollapsed}
              icon={profileFocused ? ROUTE_ICONS.profile.active : ROUTE_ICONS.profile.inactive}
              onPress={() => router.push('/login')}
            />
          )
        ) : null}

        <Pressable
          onPress={() => setSidebarCollapsed((current) => !current)}
          style={(state) => {
            const { pressed } = state;
            const hovered = Platform.OS === 'web' && 'hovered' in state && Boolean(state.hovered);
            return [
            styles.collapseToggle,
            sidebarCollapsed && styles.collapseToggleCollapsed,
            { backgroundColor: colors.input, borderColor: colors.border },
            hovered && ({ backgroundColor: `${colors.textSecondary}18` } as ViewStyle),
            pressed && { opacity: 0.85 },
            Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
          ]}}
          accessibilityRole="button"
          accessibilityLabel={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <IconSymbol name={sidebarCollapsed ? 'chevron.right' : 'chevron.left'} size={16} color={colors.textSecondary} />
          {!sidebarCollapsed ? (
            <Text style={[styles.collapseLabel, { color: colors.textSecondary }]}>Collapse</Text>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

export function PremiumMobileTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme: colors, isDark } = useTheme();
  const { user } = useAuthContext();
  const insets = useSafeAreaInsets();

  const visibleRoutes = state.routes.filter((route) => MOBILE_MAIN_ROUTES.includes(route.name as SidebarRouteName));
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'web' ? 8 : 0);

  const tabBarContent = (
    <View
      style={[
        styles.mobileBar,
        {
          backgroundColor: Platform.OS === 'web' ? 'transparent' : (isDark ? 'rgba(26, 44, 56, 0.92)' : 'rgba(255, 255, 255, 0.94)'),
          borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        },
      ]}>
      {visibleRoutes.map((route) => {
        const routeIndex = state.routes.findIndex((r) => r.key === route.key);
        const focused = state.index === routeIndex;
        const options = descriptors[route.key]?.options;
        const label = typeof options?.title === 'string' ? options.title : route.name;
        const tint = focused ? colors.primary : colors.textSecondary;
        const routeIcons = ROUTE_ICONS[route.name as SidebarRouteName];

        return (
          <Pressable
            key={route.key}
            onPress={() => {
              if (Platform.OS === 'ios') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            }}
            style={({ pressed }) => [styles.mobileTab, pressed && { opacity: 0.82 }, Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle)]}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}>
            <View style={[styles.mobileIconWrap, focused && { backgroundColor: colors.primarySoft }]}>
              {route.name === 'profile' ? (
                user?.avatar_url ? (
                  <Image
                    source={{ uri: user.avatar_url }}
                    style={[styles.mobileAvatar, focused && { borderColor: colors.primary }]}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <View style={[styles.mobileAvatarFallback, { backgroundColor: colors.input, borderColor: focused ? colors.primary : colors.border }]}>
                    <Text style={[styles.mobileAvatarInitial, { color: focused ? colors.primary : colors.textSecondary }]}>
                      {user?.username ? user.username.substring(0, 1).toUpperCase() : 'U'}
                    </Text>
                  </View>
                )
              ) : (
                <IconSymbol
                  name={focused ? routeIcons?.active ?? 'list.bullet' : routeIcons?.inactive ?? 'list.bullet'}
                  size={MOBILE_ICON_SIZE}
                  color={tint}
                />
              )}
            </View>
            <Text style={[styles.mobileLabel, { color: tint }, focused && styles.mobileLabelActive]} numberOfLines={1}>
              {label}
            </Text>
            {focused ? <View style={[styles.mobileIndicator, { backgroundColor: colors.primary }]} /> : <View style={styles.mobileIndicatorSpacer} />}
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={[styles.mobileShell, { paddingBottom: bottomInset }]}>
      {Platform.OS === 'web' ? (
        <View
          style={[
            styles.mobileBlur,
            {
              backgroundColor: isDark ? 'rgba(26, 44, 56, 0.92)' : 'rgba(255, 255, 255, 0.94)',
            },
          ]}>
          {tabBarContent}
        </View>
      ) : (
        <BlurView intensity={64} tint={isDark ? 'dark' : 'light'} style={styles.mobileBlur}>
          {tabBarContent}
        </BlurView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: '100%',
    height: '100%',
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 14,
  },
  sidebarScroll: {
    flex: 1,
  },
  sidebarScrollContent: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  sidebarHeader: {
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sidebarHeaderCollapsed: {
    alignItems: 'center',
    marginBottom: 10,
  },
  sidebarBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    minHeight: 36,
  },
  sidebarBrandRowCollapsed: {
    justifyContent: 'center',
  },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  brandMarkCompact: {
    width: 28,
    height: 28,
    borderRadius: 7,
  },
  brandMarkLetter: {
    fontSize: 14,
    fontWeight: FontWeight.semibold,
    letterSpacing: -0.2,
  },
  sidebarBrand: {
    flex: 1,
    fontSize: 15,
    fontWeight: FontWeight.semibold,
    letterSpacing: -0.25,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  sectionSpacer: {
    height: 6,
  },
  sidebarSection: {
    gap: 2,
  },
  sidebarDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 10,
    marginHorizontal: 6,
  },
  sidebarItem: {
    minHeight: 40,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  sidebarItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  sidebarActiveBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  sidebarIconShell: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: FontWeight.semibold,
    letterSpacing: -0.1,
  },
  sidebarLabelActive: {
    fontWeight: FontWeight.semibold,
  },
  sidebarHint: {
    fontSize: 11,
    fontWeight: FontWeight.semibold,
    fontVariant: ['tabular-nums'],
    marginLeft: 'auto',
    maxWidth: 72,
  },
  sidebarBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  sidebarBadgeText: {
    fontSize: 11,
    fontWeight: FontWeight.semibold,
    fontVariant: ['tabular-nums'],
  },
  sidebarAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  sidebarAvatarActive: {
    borderWidth: 1.5,
    borderColor: '#A78BFA',
  },
  sidebarAvatarFallback: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarAvatarInitial: {
    fontSize: 10,
    fontWeight: FontWeight.semibold,
  },
  sidebarFooter: {
    marginTop: 'auto',
    gap: 2,
  },
  collapseToggle: {
    marginTop: 8,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  collapseToggleCollapsed: {
    width: 36,
    minHeight: 36,
    paddingHorizontal: 0,
    alignSelf: 'center',
  },
  collapseLabel: {
    fontSize: 12,
    fontWeight: FontWeight.semibold,
  },
  mobileShell: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  mobileBlur: {
    overflow: 'hidden',
  },
  mobileBar: {
    minHeight: 56,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 4,
  },
  mobileTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 0,
  },
  mobileIconWrap: {
    width: 36,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileLabel: {
    fontSize: 10,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.1,
  },
  mobileLabelActive: {
    fontWeight: FontWeight.semibold,
  },
  mobileIndicator: {
    width: 18,
    height: 3,
    borderRadius: 2,
    marginTop: 1,
  },
  mobileIndicatorSpacer: {
    height: 4,
    marginTop: 1,
  },
  mobileAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  mobileAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileAvatarInitial: {
    fontSize: 10,
    fontWeight: FontWeight.semibold,
  },
});
