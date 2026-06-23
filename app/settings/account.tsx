import React from "react";
import { useTranslation } from "react-i18next";

import { AccountSettingsSection } from "@/components/settings/AccountSettingsSection";
import { SettingsScreenLayout } from "@/components/settings/SettingsScreenLayout";
import { AppCard } from "@/components/ui/AppCard";
import { useTheme } from "@/contexts/ThemeContext";

export default function SettingsAccountScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation("settings");

  return (
    <SettingsScreenLayout title={t("account")} showBack>
      <AppCard>
        <AccountSettingsSection theme={theme} />
      </AppCard>
    </SettingsScreenLayout>
  );
}
