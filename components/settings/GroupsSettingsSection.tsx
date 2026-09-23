import { useRouter } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { JoinGroupPanel } from "@/components/groups/JoinGroupPanel";
import { AppListRow } from "@/components/ui/AppListRow";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/ThemeContext";

type ThemeColors = {
  text: string;
  textSecondary: string;
  surface: string;
  border: string;
  primary: string;
};

interface GroupsSettingsSectionProps {
  theme: ThemeColors;
}

export function GroupsSettingsSection({ theme }: GroupsSettingsSectionProps) {
  const router = useRouter();
  const { theme: appTheme } = useTheme();
  const { t } = useTranslation("settings");

  return (
    <View style={styles.container}>
      <AppListRow
        title={t("manageGroups")}
        subtitle={t("manageGroupsHelper")}
        chevron
        leading={<IconSymbol name="person.3.fill" size={22} color={appTheme.primary} />}
        onPress={() => router.push("/manage/groups" as any)}
      />
      <JoinGroupPanel collapsible={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
});
