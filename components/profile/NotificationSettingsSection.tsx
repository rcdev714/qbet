import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Platform,
    Pressable,
    StyleSheet,
    Switch,
    Text,
    View,
} from "react-native";

import {
    EmailFrequency,
    NotificationPreferences,
    notificationPreferencesService,
    NotificationPreferencesUpdate,
} from "@/services/notificationPreferences.service";

type ThemeColors = {
  text: string;
  textSecondary: string;
  surface: string;
  border: string;
  primary: string;
  background: string;
};

interface NotificationSettingsSectionProps {
  theme: ThemeColors;
}

export function NotificationSettingsSection({ theme }: NotificationSettingsSectionProps) {
  const { t } = useTranslation("settings");
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushSupported] = useState(
    Platform.OS === "web" && typeof window !== "undefined" && "Notification" in window,
  );

  const load = useCallback(async () => {
    setLoading(true);
    const { preferences } = await notificationPreferencesService.getPreferences();
    setPrefs(preferences);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (patch: NotificationPreferencesUpdate) => {
    setSaving(true);
    const { preferences } = await notificationPreferencesService.updatePreferences(patch);
    if (preferences) setPrefs(preferences);
    setSaving(false);
  };

  const enableWebPush = async () => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        await update({ push_web_enabled: false });
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const vapidKey = process.env.EXPO_PUBLIC_WEB_PUSH_PUBLIC_KEY;
      if (!vapidKey) {
        console.warn("EXPO_PUBLIC_WEB_PUSH_PUBLIC_KEY not set");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      await notificationPreferencesService.registerWebPushSubscription(subscription);
      await update({ push_web_enabled: true });
    } catch (error) {
      console.error("Web push setup failed:", error);
    }
  };

  const disableWebPush = async () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await notificationPreferencesService.unregisterWebPushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
    }
    await update({ push_web_enabled: false });
  };

  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!prefs) return null;

  return (
    <View
      nativeID="notifications"
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{t("notificationsTitle")}</Text>
      <Text style={[styles.helperText, { color: theme.textSecondary }]}>
        {t("notificationsHelper")}
      </Text>

      <View style={[styles.infoBlock, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <Text style={[styles.infoTitle, { color: theme.text }]}>{t("requiredReceiptsTitle")}</Text>
        <Text style={[styles.infoHelper, { color: theme.textSecondary }]}>{t("requiredReceiptsHelper")}</Text>
      </View>

      {pushSupported ? (
        <ChannelSection theme={theme} title={t("channelPush")} helper={t("channelPushHelper")}>
          <ToggleRow
            theme={theme}
            label={t("pushWeb")}
            helper={t("pushWebHelper")}
            value={prefs.push_web_enabled}
            disabled={saving}
            onValueChange={async (v) => {
              if (v) await enableWebPush();
              else await disableWebPush();
            }}
          />
          <View style={styles.nested}>
            <ToggleRow
              theme={theme}
              label={t("pushMarketResults")}
              value={prefs.push_market_results}
              disabled={saving || !prefs.push_web_enabled}
              onValueChange={(v) => update({ push_market_results: v })}
            />
            <ToggleRow
              theme={theme}
              label={t("pushSocial")}
              value={prefs.push_social}
              disabled={saving || !prefs.push_web_enabled}
              onValueChange={(v) => update({ push_social: v })}
            />
          </View>
        </ChannelSection>
      ) : null}

      <ChannelSection theme={theme} title={t("channelEmail")} helper={t("channelEmailHelper")}>
        <ToggleRow
          theme={theme}
          label={t("emailMaster")}
          helper={t("emailMasterHelper")}
          value={prefs.email_enabled}
          disabled={saving}
          onValueChange={(v) => update({ email_enabled: v })}
        />
        <View style={styles.nested}>
          <ToggleRow
            theme={theme}
            label={t("emailMarketResults")}
            value={prefs.email_market_results}
            disabled={saving || !prefs.email_enabled}
            onValueChange={(v) => update({ email_market_results: v })}
          />
          <ToggleRow
            theme={theme}
            label={t("emailSocial")}
            value={prefs.email_social}
            disabled={saving || !prefs.email_enabled}
            onValueChange={(v) => update({ email_social: v })}
          />
          <ToggleRow
            theme={theme}
            label={t("emailGroupInvites")}
            helper={t("emailGroupInvitesHelper")}
            value={prefs.email_group_invites}
            disabled={saving || !prefs.email_enabled}
            onValueChange={(v) => update({ email_group_invites: v })}
          />
          <FrequencyRow
            theme={theme}
            label={t("emailFrequency")}
            helper={t("emailFrequencyHelper")}
            value={prefs.email_frequency ?? "immediate"}
            disabled={saving || !prefs.email_enabled}
            onChange={(v) => update({ email_frequency: v })}
          />
          <ToggleRow
            theme={theme}
            label={t("emailSkipIfRead")}
            helper={t("emailSkipIfReadHelper")}
            value={prefs.email_skip_if_read ?? true}
            disabled={saving || !prefs.email_enabled}
            onValueChange={(v) => update({ email_skip_if_read: v })}
          />
        </View>
      </ChannelSection>

      <ChannelSection theme={theme} title={t("channelInApp")} helper={t("channelInAppHelper")}>
        <ToggleRow
          theme={theme}
          label={t("inAppMaster")}
          helper={t("inAppMasterHelper")}
          value={prefs.in_app_enabled}
          disabled={saving}
          onValueChange={(v) => update({ in_app_enabled: v })}
        />
        <View style={styles.nested}>
          <ToggleRow
            theme={theme}
            label={t("inAppMarketResults")}
            value={prefs.in_app_market_results}
            disabled={saving || !prefs.in_app_enabled}
            onValueChange={(v) => update({ in_app_market_results: v })}
          />
          <ToggleRow
            theme={theme}
            label={t("inAppSocial")}
            value={prefs.in_app_social}
            disabled={saving || !prefs.in_app_enabled}
            onValueChange={(v) => update({ in_app_social: v })}
          />
        </View>
      </ChannelSection>
    </View>
  );
}

function ChannelSection({
  theme,
  title,
  helper,
  children,
}: {
  theme: ThemeColors;
  title: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.channel, { borderTopColor: theme.border }]}>
      <Text style={[styles.channelTitle, { color: theme.text }]}>{title}</Text>
      {helper ? (
        <Text style={[styles.channelHelper, { color: theme.textSecondary }]}>{helper}</Text>
      ) : null}
      {children}
    </View>
  );
}

function FrequencyRow({
  theme,
  label,
  helper,
  value,
  disabled,
  onChange,
}: {
  theme: ThemeColors;
  label: string;
  helper?: string;
  value: EmailFrequency;
  disabled?: boolean;
  onChange: (v: EmailFrequency) => void;
}) {
  const { t } = useTranslation("settings");
  const options: EmailFrequency[] = ["immediate", "daily_digest", "weekly_digest"];

  return (
    <View style={[styles.row, { borderBottomColor: theme.border, flexDirection: "column", alignItems: "stretch" }]}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      {helper ? (
        <Text style={[styles.rowHelper, { color: theme.textSecondary, marginBottom: 8 }]}>{helper}</Text>
      ) : null}
      <View style={styles.frequencyRow}>
        {options.map((opt) => {
          const selected = value === opt;
          return (
            <Pressable
              key={opt}
              disabled={disabled}
              onPress={() => onChange(opt)}
              style={[
                styles.frequencyChip,
                {
                  borderColor: selected ? theme.primary : theme.border,
                  backgroundColor: selected ? theme.primary + "18" : "transparent",
                },
              ]}>
              <Text style={{ color: selected ? theme.primary : theme.textSecondary, fontSize: 13 }}>
                {t(`emailFrequency_${opt}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ToggleRow({
  theme,
  label,
  helper,
  value,
  disabled,
  onValueChange,
}: {
  theme: ThemeColors;
  label: string;
  helper?: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      style={[styles.row, { borderBottomColor: theme.border }]}
      onPress={() => !disabled && onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      accessibilityLabel={label}>
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
        {helper ? (
          <Text style={[styles.rowHelper, { color: theme.textSecondary }]}>{helper}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ false: theme.border, true: theme.primary }}
      />
    </Pressable>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 4,
  },
  helperText: {
    fontSize: 13,
    marginBottom: 12,
  },
  channel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    marginTop: 4,
    gap: 2,
  },
  channelTitle: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  channelHelper: {
    fontSize: 12,
    marginBottom: 6,
    lineHeight: 16,
  },
  nested: {
    paddingLeft: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  rowText: {
    flex: 1,
    paddingRight: 12,
  },
  label: {
    fontSize: 15,
  },
  rowHelper: {
    fontSize: 12,
    marginTop: 2,
  },
  infoBlock: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  infoHelper: {
    fontSize: 12,
    lineHeight: 16,
  },
  frequencyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  frequencyChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: "center",
  },
});
