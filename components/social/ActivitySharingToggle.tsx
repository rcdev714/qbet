import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Switch, View } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { useSocialFollow } from "@/contexts/SocialFollowContext";
import { useTheme } from "@/contexts/ThemeContext";
import { socialService } from "@/services/social.service";

export function ActivitySharingToggle() {
  const { theme } = useTheme();
  const { t } = useTranslation("settings");
  const { refreshActivity } = useSocialFollow();
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const value = await socialService.getShowActivityOnFeed();
    setEnabled(value);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onChange = async (next: boolean) => {
    setEnabled(next);
    setError(null);
    const { enabled: saved, error: saveError } = await socialService.setShowActivityOnFeed(next);
    if (saveError) {
      setEnabled(!next);
      setError(t("showActivityOnFeedError"));
      return;
    }
    setEnabled(saved);
    refreshActivity();
  };

  return (
    <View testID="activity-sharing-toggle" style={styles.wrap}>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: enabled, disabled: loading }}
        accessibilityLabel={t("showActivityOnFeed")}
        accessibilityHint={t("showActivityOnFeedHelper")}
        disabled={loading}
        onPress={() => void onChange(!enabled)}
        style={styles.row}
      >
        <View style={styles.copy}>
          <AppText variant="body">{t("showActivityOnFeed")}</AppText>
          <AppText variant="caption" color="secondary">
            {t("showActivityOnFeedHelper")}
          </AppText>
        </View>
        <Switch
          value={enabled}
          disabled={loading}
          onValueChange={(value) => void onChange(value)}
          accessibilityLabel={t("showActivityOnFeed")}
          trackColor={{ false: theme.border, true: theme.primary }}
        />
      </Pressable>
      {error ? (
        <AppText variant="caption" color="destructive">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
  },
  copy: { flex: 1, gap: 4 },
});
