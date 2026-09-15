import { AppText } from "@/components/ui/AppText";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { GROUPS_LIST_PANE_WIDTH, DESKTOP_BREAKPOINT } from "@/constants/layout";
import { useTheme } from "@/contexts/ThemeContext";
import { useRouter } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

export type GroupAdminTab = "overview" | "predictions" | "disputes" | "members" | "settings";

type GroupAdminShellProps = {
  groupName?: string;
  children: React.ReactNode;
  activeTab: GroupAdminTab;
  onTabChange: (tab: GroupAdminTab) => void;
  disputeBadge?: number;
  predictionBadge?: number;
};

const TABS: GroupAdminTab[] = ["overview", "predictions", "disputes", "members", "settings"];

export function GroupAdminShell({
  groupName,
  children,
  activeTab,
  onTabChange,
  disputeBadge = 0,
  predictionBadge = 0,
}: GroupAdminShellProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { t } = useTranslation("groupAdmin");
  const isWide = width >= DESKTOP_BREAKPOINT;

  const tabLabels = TABS.map((tab) => {
    let label = t(tab);
    if (tab === "disputes" && disputeBadge > 0) label += ` (${disputeBadge})`;
    if (tab === "predictions" && predictionBadge > 0) label += ` (${predictionBadge})`;
    return label;
  });

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={Platform.OS === "web" ? ({ cursor: "pointer" } as object) : undefined}
        >
          <AppText variant="bodySm" color="primary">
            {t("backToApp")}
          </AppText>
        </TouchableOpacity>
        {groupName ? (
          <AppText variant="title3" style={styles.title}>
            {groupName}
          </AppText>
        ) : null}
      </View>

      <View style={isWide ? styles.wideBody : styles.body}>
        {isWide ? (
          <View style={[styles.sidebar, { borderRightColor: theme.border }]}>
            {TABS.map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => onTabChange(tab)}
                style={[
                  styles.navItem,
                  activeTab === tab && { backgroundColor: theme.primarySoft },
                  Platform.OS === "web" ? ({ cursor: "pointer" } as object) : undefined,
                ]}
              >
                <AppText variant="bodySm" color={activeTab === tab ? "primary" : "secondary"}>
                  {tabLabels[TABS.indexOf(tab)]}
                </AppText>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.mobileTabs}>
            <SegmentedControl
              value={activeTab}
              segments={TABS.map((tab) => ({ value: tab, label: tabLabels[TABS.indexOf(tab)] }))}
              onChange={(tab) => onTabChange(tab)}
            />
          </View>
        )}
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  title: { marginTop: 4 },
  body: { flex: 1, minHeight: 0 },
  wideBody: { flex: 1, flexDirection: "row", minHeight: 0 },
  sidebar: {
    width: Math.min(GROUPS_LIST_PANE_WIDTH, 220),
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  navItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: "center",
  },
  mobileTabs: { paddingHorizontal: 12, paddingVertical: 8 },
  content: { flex: 1 },
  contentInner: { padding: 16, gap: 12, paddingBottom: 40 },
});
