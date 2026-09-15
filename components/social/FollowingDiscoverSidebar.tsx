import { DiscoverPeopleList } from "@/components/social/DiscoverPeopleList";
import { AppButton } from "@/components/ui/AppButton";
import { AppText } from "@/components/ui/AppText";
import { DISCOVER_PANE_WIDTH } from "@/constants/layout";
import { useTheme } from "@/contexts/ThemeContext";
import { useRouter } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";

export function FollowingDiscoverSidebar() {
  const { theme } = useTheme();
  const router = useRouter();
  const { t } = useTranslation("social");

  return (
    <View
      style={[
        styles.pane,
        {
          width: DISCOVER_PANE_WIDTH,
          borderLeftColor: theme.border,
          backgroundColor: theme.background,
        },
      ]}
      testID="following-discover-sidebar"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <AppText variant="caption" color="secondary" style={styles.title}>
          {t("discoverSuggestedForYou")}
        </AppText>
        <DiscoverPeopleList
          variant="sidebar"
          scrollEnabled={false}
          showHeader={false}
          suggestedFirst
          pageSize={12}
        />
        <AppButton
          title={t("discoverSeeAll")}
          variant="secondary"
          size="sm"
          onPress={() => router.push("/discover" as any)}
          style={styles.seeAll}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pane: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 12,
  },
  title: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "600",
  },
  seeAll: {
    alignSelf: "stretch",
    marginTop: 4,
  },
});
