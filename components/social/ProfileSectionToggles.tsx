import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Switch, View } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { useTheme } from "@/contexts/ThemeContext";
import type { ProfilePrivacySettings } from "@/lib/social/profile-privacy";
import { supabase } from "@/lib/supabase";
import { socialService } from "@/services/social.service";

type SectionKey = "show_open_bets" | "show_results" | "show_activity_logs" | "show_verified_badge";

const DEFAULTS: Pick<ProfilePrivacySettings, SectionKey> = {
  show_open_bets: true,
  show_results: true,
  show_activity_logs: true,
  show_verified_badge: false,
};

const ROWS: { key: SectionKey; title: string; helper: string }[] = [
  { key: "show_open_bets", title: "showOpenBets", helper: "showOpenBetsHelper" },
  { key: "show_results", title: "showResults", helper: "showResultsHelper" },
  { key: "show_activity_logs", title: "showActivityLogs", helper: "showActivityLogsHelper" },
  { key: "show_verified_badge", title: "showVerifiedBadge", helper: "showVerifiedBadgeHelper" },
];

export function ProfileSectionToggles() {
  const { theme } = useTheme();
  const { t } = useTranslation("settings");
  const [values, setValues] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) {
      setLoading(false);
      return;
    }
    const result = await socialService.getProfilePrivacy(userId);
    if (result.privacy?.settings) {
      setValues({
        show_open_bets: result.privacy.settings.show_open_bets,
        show_results: result.privacy.settings.show_results,
        show_activity_logs: result.privacy.settings.show_activity_logs,
        show_verified_badge: result.privacy.settings.show_verified_badge,
      });
    } else if (result.error) {
      setError(t("profileSectionPrivacyError"));
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const onChange = async (key: SectionKey, next: boolean) => {
    const previous = values;
    const updated = { ...values, [key]: next };
    setValues(updated);
    setError(null);
    const { error: saveError } = await socialService.setProfileSectionPrivacy(updated);
    if (saveError) {
      setValues(previous);
      setError(t("profileSectionPrivacyError"));
    }
  };

  return (
    <View testID="profile-section-toggles" style={styles.wrap}>
      {ROWS.map((row) => (
        <Pressable
          key={row.key}
          accessibilityRole="switch"
          accessibilityState={{ checked: values[row.key], disabled: loading }}
          accessibilityLabel={t(row.title)}
          accessibilityHint={t(row.helper)}
          disabled={loading}
          onPress={() => void onChange(row.key, !values[row.key])}
          style={styles.row}
        >
          <View style={styles.copy}>
            <AppText variant="body">{t(row.title)}</AppText>
            <AppText variant="caption" color="secondary">
              {t(row.helper)}
            </AppText>
          </View>
          <Switch
            value={values[row.key]}
            disabled={loading}
            onValueChange={(value) => void onChange(row.key, value)}
            accessibilityLabel={t(row.title)}
            trackColor={{ false: theme.border, true: theme.primary }}
          />
        </Pressable>
      ))}
      {error ? (
        <AppText variant="caption" color="destructive">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
  },
  copy: { flex: 1, gap: 4 },
});
