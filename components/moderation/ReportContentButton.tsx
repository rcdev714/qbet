import { Brand } from "@/constants/theme";
import type { ContentReportTargetType } from "@/services/moderation.service";
import { moderationService } from "@/services/moderation.service";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const REASON_KEYS = [
  "reportReasonHarassment",
  "reportReasonHate",
  "reportReasonViolence",
  "reportReasonSexual",
  "reportReasonSpam",
  "reportReasonOther",
] as const;

type ReportContentButtonProps = {
  targetType: ContentReportTargetType;
  targetId: string;
  targetUserId?: string | null;
  label?: string;
  theme?: {
    text: string;
    textSecondary: string;
    surface: string;
    border: string;
    primary: string;
  };
};

export function ReportContentButton({
  targetType,
  targetId,
  targetUserId,
  label,
  theme = {
    text: Brand.deep,
    textSecondary: Brand.mutedText,
    surface: "#FFFFFF",
    border: "rgba(15,23,42,0.12)",
    primary: Brand.primary,
  },
}: ReportContentButtonProps) {
  const { t } = useTranslation("compliance");
  const reasons = useMemo(
    () => REASON_KEYS.map((key) => t(key)),
    [t],
  );
  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (reasons.length > 0 && !reason) {
      setReason(reasons[0]);
    }
  }, [reason, reasons]);

  const submit = async () => {
    setSubmitting(true);
    try {
      await moderationService.reportContent({
        targetType,
        targetId,
        targetUserId,
        reason,
        details: details.trim() || null,
      });
      setVisible(false);
      setDetails("");
      Alert.alert(t("reportSubmittedTitle"), t("reportSubmittedBody"));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("reportFailedBody");
      Alert.alert(t("reportFailedTitle"), message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={[styles.trigger, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
      >
        <Text style={[styles.triggerText, { color: theme.textSecondary }]}>{label ?? t("reportLabel")}</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.title, { color: theme.text }]}>{t("reportContent")}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {t("reportSubtitle")}
            </Text>

            <View style={styles.reasonList}>
              {reasons.map((item) => (
                <TouchableOpacity
                  key={item}
                  onPress={() => setReason(item)}
                  style={[
                    styles.reasonRow,
                    { borderColor: theme.border },
                    reason === item && { borderColor: theme.primary, backgroundColor: `${theme.primary}12` },
                  ]}
                >
                  <Text style={{ color: theme.text }}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder={t("reportDetailsPlaceholder")}
              placeholderTextColor={theme.textSecondary}
              multiline
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            />

            <TouchableOpacity
              onPress={submit}
              disabled={submitting}
              style={[styles.submit, { backgroundColor: theme.primary, opacity: submitting ? 0.7 : 1 }]}
            >
              <Text style={styles.submitText}>{submitting ? t("reportSubmitting") : t("reportSubmit")}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  triggerText: {
    fontSize: 11,
    fontWeight: "500",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 12,
    maxWidth: 480,
    alignSelf: "center",
    width: "100%",
  },
  title: {
    fontSize: 18,
    fontWeight: '400',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  reasonList: {
    gap: 8,
  },
  reasonRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top",
    fontSize: 15,
  },
  submit: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitText: {
    color: "#fff",
    fontWeight: '400',
    fontSize: 16,
  },
});
