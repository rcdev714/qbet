import React from "react";
import { useTranslation } from "react-i18next";

import { SettingsScreenLayout } from "@/components/settings/SettingsScreenLayout";
import { AppCard } from "@/components/ui/AppCard";
import { AppText } from "@/components/ui/AppText";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ThemeMode, useTheme } from "@/contexts/ThemeContext";

const THEME_OPTIONS: ThemeMode[] = ["system", "dark", "light"];

const THEME_LABEL_KEYS: Record<ThemeMode, "themeSystem" | "themeDark" | "themeLight"> = {
  system: "themeSystem",
  dark: "themeDark",
  light: "themeLight",
};

export default function SettingsAppearanceScreen() {
  const { mode, setMode } = useTheme();
  const { t } = useTranslation("settings");

  const themeSegments = THEME_OPTIONS.map((option) => ({
    value: option,
    label: t(THEME_LABEL_KEYS[option]),
  }));

  return (
    <SettingsScreenLayout title={t("appearance")} showBack>
      <AppCard style={{ gap: 12 }}>
        <AppText variant="bodySm" color="secondary">
          {t("appearanceHelper")}
        </AppText>
        <SegmentedControl value={mode} segments={themeSegments} onChange={setMode} />
      </AppCard>
    </SettingsScreenLayout>
  );
}
