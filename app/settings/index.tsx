import { useRouter } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { Alert, StyleSheet } from "react-native";

import { SettingsScreenLayout } from "@/components/settings/SettingsScreenLayout";
import { AppCard } from "@/components/ui/AppCard";
import { AppListRow } from "@/components/ui/AppListRow";
import { AppText } from "@/components/ui/AppText";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

export default function SettingsHubScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { signOut } = useAuthContext();
  const { t } = useTranslation("settings");

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) Alert.alert(t("signOutError"), error.message);
  };

  return (
    <SettingsScreenLayout title={t("title")} showBack scrollProps={{ contentContainerStyle: styles.content }}>
      <AppText variant="bodySm" color="secondary" style={styles.subtitle}>
        {t("subtitle")}
      </AppText>

      <AppCard padded={false} style={styles.listCard}>
        <AppListRow
          title={t("account")}
          subtitle={t("accountHelper")}
          chevron
          leading={<IconSymbol name="person.fill" size={22} color={theme.primary} />}
          onPress={() => router.push("/settings/account" as any)}
        />
        <AppListRow
          title={t("profileStatus")}
          subtitle={t("profileStatusHelper")}
          chevron
          leading={<IconSymbol name="sparkles" size={22} color={theme.primary} />}
          onPress={() => router.push("/settings/profile" as any)}
        />
        <AppListRow
          title={t("notificationsTitle")}
          subtitle={t("notificationsHelper")}
          chevron
          leading={<IconSymbol name="bell" size={22} color={theme.primary} />}
          onPress={() => router.push("/settings/notifications" as any)}
        />
        <AppListRow
          title={t("groupsTitle")}
          subtitle={t("manageGroupsHelper")}
          chevron
          leading={<IconSymbol name="person.3.fill" size={22} color={theme.primary} />}
          onPress={() => router.push("/settings/groups" as any)}
        />
        <AppListRow
          title={t("appearance")}
          subtitle={t("appearanceHelper")}
          chevron
          leading={<IconSymbol name="gearshape" size={22} color={theme.primary} />}
          onPress={() => router.push("/settings/appearance" as any)}
        />
        <AppListRow
          title={t("privacyTitle")}
          subtitle={t("privacyHelper")}
          chevron
          leading={<IconSymbol name="shield" size={22} color={theme.primary} />}
          onPress={() => router.push("/settings/privacy" as any)}
        />
      </AppCard>

      <AppCard padded={false} style={styles.listCard}>
        <AppListRow
          title={t("signOut")}
          subtitle={t("sessionHelper")}
          leading={<IconSymbol name="rectangle.portrait.and.arrow.right" size={22} color={theme.error} />}
          onPress={handleSignOut}
        />
      </AppCard>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14 },
  subtitle: { marginBottom: 4 },
  listCard: {
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
});
