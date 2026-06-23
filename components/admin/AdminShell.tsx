import { IconSymbol } from "@/components/ui/icon-symbol";
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

export const ADMIN_SIDEBAR_WIDTH = 220;
export const ADMIN_BREAKPOINT = 900;
export const ADMIN_CONTENT_MAX_WIDTH = 1120;

type AdminShellProps = {
  children: React.ReactNode;
  title?: string;
  badge?: number;
};

const PLATFORM_HOME = "/(tabs)/feed" as const;

export function useAdminLayoutMetrics() {
  const { width, height } = useWindowDimensions();
  const isWide = width >= ADMIN_BREAKPOINT;
  const mainPaneWidth = isWide ? width - ADMIN_SIDEBAR_WIDTH : width;
  const contentWidth = Math.min(mainPaneWidth - 48, ADMIN_CONTENT_MAX_WIDTH);

  return { width, height, isWide, mainPaneWidth, contentWidth };
}

export function AdminShell({ children, title, badge }: AdminShellProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const { t } = useTranslation("admin");
  const { height, isWide } = useAdminLayoutMetrics();

  const currentPath = segments.join("/");
  const isUsers = currentPath.includes("admin/users");
  const isOverview = !isUsers;

  const navItems = [
    {
      key: "overview",
      label: t("overview"),
      href: "/admin-dashboard",
      icon: "chart.bar" as const,
      active: isOverview,
    },
    { key: "users", label: t("users"), href: "/admin/users", icon: "person.2" as const, active: isUsers },
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
      <View style={[styles.pageHeader, { borderBottomColor: theme.border }]}>
        <Text style={[styles.pageTitle, { color: theme.text }]}>{title}</Text>
        {badge != null && badge > 0 ? (
          <View style={[styles.badge, { backgroundColor: theme.primary }]}>
            <Text style={[styles.badgeText, { color: theme.onPrimary }]}>{badge}</Text>
          </View>
        ) : null}
      </View>
    ) : null;

  const navItem = (item: (typeof navItems)[number]) => (
    <TouchableOpacity
      key={item.key}
      onPress={() => router.push(item.href as any)}
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
                <Text style={[styles.sidebarSubtext, { color: theme.textSecondary }]}>AnyMarket</Text>
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
              <View style={styles.mobileNav}>
                {navItems.map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    onPress={() => router.push(item.href as any)}
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
    fontWeight: "700",
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
    fontWeight: "600",
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
    fontWeight: "700",
  },
  contentSlot: {
    flex: 1,
    minHeight: 0,
  },
  contentInner: {
    flex: 1,
    width: "100%",
    maxWidth: ADMIN_CONTENT_MAX_WIDTH,
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
  mobileNav: {
    flexDirection: "row",
    gap: 8,
  },
  mobileNavItem: {
    flex: 1,
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
    fontWeight: "600",
  },
});
