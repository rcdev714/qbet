import React from "react";
import { useTranslation } from "react-i18next";

import { ProfileStatusSection } from "@/components/settings/ProfileStatusSection";
import { SettingsScreenLayout } from "@/components/settings/SettingsScreenLayout";
import { AppCard } from "@/components/ui/AppCard";
import { useTheme } from "@/contexts/ThemeContext";

export default function SettingsProfileScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation("settings");

  return (
    <SettingsScreenLayout title={t("profileStatus")} showBack>
      <AppCard>
        <ProfileStatusSection theme={theme} />
      </AppCard>
    </SettingsScreenLayout>
  );
}
