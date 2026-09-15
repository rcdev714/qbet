import { AppButton, AppText } from "@/components/ui";
import { GROUP_SETTLEMENT_NOTICE } from "@/lib/legal/group-settlement-disclosure";
import { PLATFORM_INTEGRITY_NOTICE } from "@/lib/legal/platform-integrity-disclosure";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { SUPPORT_EMAIL } from "@/lib/brand";

type GroupAdminDisclaimerScreenProps = {
  onAccept: () => Promise<boolean>;
  submitting?: boolean;
};

export function GroupAdminDisclaimerScreen({
  onAccept,
  submitting = false,
}: GroupAdminDisclaimerScreenProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const { t } = useTranslation("groupAdmin");
  const [checked, setChecked] = useState(false);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      <AppText variant="title2">{t("disclaimerTitle")}</AppText>
      <AppText variant="bodySm" color="secondary">
        {GROUP_SETTLEMENT_NOTICE.adminDisclaimerSummary}
      </AppText>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <AppText variant="bodySm">• You are responsible for fair, evidence-based settlement of group predictions.</AppText>
        <AppText variant="bodySm">• Members who bet may optionally share settlement feedback; negative feedback requires a written explanation.</AppText>
        <AppText variant="bodySm">• Sustained, genuine concern may trigger algorithmic review and possible reopening — not a simple majority vote.</AppText>
        <AppText variant="bodySm">• Anymarkt uses a proprietary fraud detection engine and may override settlements for legal, compliance, fraud, or safety reasons.</AppText>
        <AppText variant="bodySm">• Live-wallet groups require KYC and compliance with market rules.</AppText>
      </View>

      <TouchableOpacity
        onPress={() => router.push("/group-settlements" as never)}
        style={Platform.OS === "web" ? ({ cursor: "pointer" } as object) : undefined}
      >
        <AppText variant="bodySm" color="primary">
          {t("settlementReviewLink")}
        </AppText>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/platform-integrity" as never)}
        style={Platform.OS === "web" ? ({ cursor: "pointer" } as object) : undefined}
      >
        <AppText variant="bodySm" color="primary">
          {PLATFORM_INTEGRITY_NOTICE.linkLabel}
        </AppText>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        style={Platform.OS === "web" ? ({ cursor: "pointer" } as object) : undefined}
      >
        <AppText variant="caption" color="secondary">
          {SUPPORT_EMAIL}
        </AppText>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setChecked((v) => !v)}
        style={[styles.checkRow, Platform.OS === "web" ? ({ cursor: "pointer" } as object) : undefined]}
      >
        <View style={[styles.checkbox, { borderColor: theme.border, backgroundColor: checked ? theme.primary : theme.surface }]} />
        <AppText variant="bodySm" style={styles.checkLabel}>
          {t("disclaimerCheckbox")}
        </AppText>
      </TouchableOpacity>

      <AppButton
        title={t("disclaimerAccept")}
        disabled={!checked || submitting}
        loading={submitting}
        onPress={() => void onAccept()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1 },
  checkLabel: { flex: 1 },
});
