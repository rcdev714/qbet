import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, StyleSheet, View } from "react-native";

import { DeleteAccountSection } from "@/components/legal/DeleteAccountSection";
import { ActivitySharingToggle } from "@/components/social/ActivitySharingToggle";
import { ResidenceSettingsSection } from "@/components/profile/ResidenceSettingsSection";
import { RulesModal } from "@/components/profile/RulesModal";
import { SettingsScreenLayout } from "@/components/settings/SettingsScreenLayout";
import { AppCard } from "@/components/ui/AppCard";
import { AppListRow } from "@/components/ui/AppListRow";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

export default function SettingsPrivacyScreen() {
  const { theme } = useTheme();
  const { signOut } = useAuthContext();
  const { t } = useTranslation("settings");
  const [rulesVisible, setRulesVisible] = useState(false);

  return (
    <View style={styles.root}>
      <SettingsScreenLayout title={t("privacyTitle")} showBack scrollProps={{ contentContainerStyle: styles.content }}>
        <AppCard style={styles.listCard}>
          <ActivitySharingToggle />
        </AppCard>

        <ResidenceSettingsSection theme={theme} />

        <AppCard padded={false} style={styles.listCard}>
          <AppListRow
            title={t("rules")}
            subtitle={t("rulesHelper")}
            chevron
            leading={<IconSymbol name="doc.text" size={22} color={theme.primary} />}
            onPress={() => setRulesVisible(true)}
          />
        </AppCard>

        <DeleteAccountSection
          theme={theme}
          onDeleted={async () => {
            const { error } = await signOut();
            if (error) Alert.alert(t("signOutIssue"), error.message);
          }}
        />
      </SettingsScreenLayout>

      <RulesModal visible={rulesVisible} onClose={() => setRulesVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: 14 },
  listCard: {
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
});
