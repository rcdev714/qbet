import { AppText } from "@/components/ui/AppText";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
    ADMIN_SIDEBAR_WIDTH,
    CONTENT_MAX_WIDTH_WIDE,
    DESKTOP_BREAKPOINT,
} from "@/constants/layout";
import { useTheme } from "@/contexts/ThemeContext";
import { useRouter, useSegments } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import {
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";

export { DESKTOP_BREAKPOINT as ADMIN_BREAKPOINT, CONTENT_MAX_WIDTH_WIDE as ADMIN_CONTENT_MAX_WIDTH, ADMIN_SIDEBAR_WIDTH };

type AdminShellProps = {
  children: React.ReactNode;
  title?: string;
  badge?: number;
};

const PLATFORM_HOME = "/(tabs)/feed" as const;

export function useAdminLayoutMetrics() {
  const { width, height } = useWindowDimensions();
  const isWide = width >= DESKTOP_BREAKPOINT;
  const mainPaneWidth = isWide ? width - ADMIN_SIDEBAR_WIDTH : width;
  const contentWidth = Math.min(mainPaneWidth - 48, CONTENT_MAX_WIDTH_WIDE);

  return { width, height, isWide, mainPaneWidth, contentWidth };
}

export function AdminShell({ children, title, badge }: AdminShellProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const { t } = useTranslation("admin");
  const { height, isWide } = useAdminLayoutMetrics();

  const currentPath = segments.join("/");
  const isOverview = currentPath.includes("admin-dashboard");
  const isUsers = currentPath.includes("admin/users");
  const isTransactions = currentPath.includes("admin/transactions");
  const isReports = currentPath.includes("admin/reports");

  const navItems: Array<{
    key: string;
    label: string;
    href: string;
    icon: "chart.bar" | "arrow.left.arrow.right" | "doc.text" | "person.2" | "house";
    active: boolean;
    params?: Record<string, string>;
  }> = [
    {
      key: "overview",
      label: t("overview"),
      href: "/admin-dashboard",
      icon: "chart.bar",
      active: isOverview,
    },
    {
      key: "feed",
      label: t("feedManager"),
      href: "/(tabs)/feed",
      icon: "house",
      active: false,
      params: { adminFeed: "open" },
    },
    {
      key: "transactions",
      label: t("transactions"),
      href: "/admin/transactions",
      icon: "arrow.left.arrow.right",
      active: isTransactions,
    },
    {
      key: "reports",
      label: t("reports"),
      href: "/admin/reports",
      icon: "doc.text",
      active: isReports,
    },
    {
      key: "users",
      label: t("users"),
      href: "/admin/users",
      icon: "person.2",
      active: isUsers,
    },
  ];

  const goToPlatform = () => {
    router.replace(PLATFORM_HOME as any);
  };

  const backButton = (
    <TouchableOpacity
      onPress={goToPlatform}
      style={[
        styles.backButton,
        { borderColor: theme.border, backgroundColor: theme.surface },
        Platform.OS === "web" && ({ cursor: "pointer" } as any),
      ]}
      activeOpacity={0.82}
    >
      <IconSymbol name="arrow.left" size={18} color={theme.textSecondary} />
      <Text style={[styles.backLabel, { color: theme.textSecondary }]} numberOfLines={1}>
        {t("backToPlatform")}
      </Text>
    </TouchableOpacity>
  );

  const pageHeader =
    title != null ? (
      <View style={[styles.pageHeader, { borderBottomColor: theme.borderSubtle }]}>
        <AppText variant="title2">{title}</AppText>
        {badge != null && badge > 0 ? (
          <View style={[styles.badge, { backgroundColor: theme.primary }]}>
            <Text style={[styles.badgeText, { color: theme.onPrimary }]}>{badge}</Text>
          </View>
        ) : null}
      </View>
    ) : null;

  const navigateAdminItem = (item: (typeof navItems)[number]) => {
    if (item.params) {
      router.push({ pathname: item.href, params: item.params } as any);
      return;
    }
    router.push(item.href as any);
  };

  const navItem = (item: (typeof navItems)[number]) => (
    <TouchableOpacity
      key={item.key}
      onPress={() => navigateAdminItem(item)}
      style={[
        styles.sidebarItem,
        item.active && { backgroundColor: theme.primarySoft, borderColor: theme.primary },
        Platform.OS === "web" && ({ cursor: "pointer" } as any),
      ]}
      activeOpacity={0.82}
    >
      <IconSymbol name={item.icon} size={20} color={item.active ? theme.primary : theme.textSecondary} />
      <Text style={[styles.sidebarLabel, { color: item.active ? theme.primary : theme.textSecondary }]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  const shellHeightStyle =
    Platform.OS === "web" ? ({ minHeight: height, height: "100%" } as any) : { flex: 1 };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }, shellHeightStyle]}>
      <View style={[styles.container, shellHeightStyle]}>
        {isWide ? (
          <View style={styles.wideLayout}>
            <View
              style={[
                styles.sidebar,
                { backgroundColor: theme.background, borderRightColor: theme.border },
              ]}
            >
              <View style={styles.sidebarTop}>
                <Text style={[styles.sidebarBrand, { color: theme.text }]}>Admin</Text>
                <Text style={[styles.sidebarSubtext, { color: theme.textSecondary }]}>Anymarkt</Text>
              </View>
              <View style={styles.sidebarSection}>{navItems.map(navItem)}</View>
              <View style={styles.sidebarFooter}>{backButton}</View>
            </View>

            <View style={styles.main}>
              {pageHeader}
              <View style={styles.contentSlot}>
                <View style={styles.contentInner}>{children}</View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.main}>
            <View style={[styles.mobileTopBar, { borderBottomColor: theme.border }]}>
              {backButton}
              <View style={styles.mobileNavScroll}>
                {navItems.map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    onPress={() => navigateAdminItem(item)}
                    style={[
                      styles.mobileNavItem,
                      item.active && { backgroundColor: theme.primarySoft, borderColor: theme.primary },
                      Platform.OS === "web" && ({ cursor: "pointer" } as any),
                    ]}
                    activeOpacity={0.85}
                  >
                    <IconSymbol
                      name={item.icon}
                      size={16}
                      color={item.active ? theme.primary : theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.mobileNavLabel,
                        { color: item.active ? theme.primary : theme.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {pageHeader}
            <View style={styles.contentSlot}>
              <View style={styles.contentInner}>{children}</View>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  wideLayout: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
  },
  sidebar: {
    width: ADMIN_SIDEBAR_WIDTH,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 20,
    paddingBottom: 16,
  },
  sidebarTop: {
    marginBottom: 18,
  },
  sidebarBrand: {
    fontSize: 17,
    fontWeight: "400",
    letterSpacing: -0.2,
  },
  sidebarSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  sidebarSection: {
    gap: 4,
    flex: 1,
  },
  sidebarFooter: {
    paddingTop: 12,
  },
  sidebarItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
  },
  sidebarLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  backLabel: {
    fontSize: 13,
    fontWeight: "500",
    flexShrink: 1,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '400',
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '400',
  },
  contentSlot: {
    flex: 1,
    minHeight: 0,
  },
  contentInner: {
    flex: 1,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH_WIDE,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
    minHeight: 0,
  },
  mobileTopBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  mobileNavScroll: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  mobileNav: {
    flexDirection: "row",
    gap: 8,
  },
  mobileNavItem: {
    minWidth: "47%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
  },
  mobileNavLabel: {
    fontSize: 14,
    fontWeight: '400',
  },
});
