import React from "react";
import { useTranslation } from "react-i18next";

import { NotificationSettingsSection } from "@/components/profile/NotificationSettingsSection";
import { SettingsScreenLayout } from "@/components/settings/SettingsScreenLayout";
import { useTheme } from "@/contexts/ThemeContext";

export default function SettingsNotificationsScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation("settings");

  return (
    <SettingsScreenLayout title={t("notificationsTitle")} showBack>
      <NotificationSettingsSection theme={theme} />
    </SettingsScreenLayout>
  );
}
