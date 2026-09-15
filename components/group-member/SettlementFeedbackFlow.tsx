import { AppButton, AppText } from "@/components/ui";
import { CONCERN_COMMENT_MIN_LENGTH } from "@/lib/settlement/feedback-constants";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import type { SettlementFairness } from "@/types/settlement-governance";

type FlowStep = "initial" | "explain" | "confirm";

export type SettlementFeedbackFlowProps = {
  visible: boolean;
  marketId: string;
  marketQuestion?: string;
  onSkip: () => void;
  onNotSure: () => void;
  onSubmit: (input: {
    score: number;
    fairness: SettlementFairness;
    comment?: string;
  }) => Promise<{ ok: boolean; error?: Error | null }>;
};

export function SettlementFeedbackFlow({
  visible,
  marketId,
  marketQuestion,
  onSkip,
  onNotSure,
  onSubmit,
}: SettlementFeedbackFlowProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const { t } = useTranslation("groupMember");
  const [step, setStep] = useState<FlowStep>("initial");
  const [comment, setComment] = useState("");
  const [score, setScore] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setStep("initial");
      setComment("");
      setScore(2);
      setError(null);
      setSubmitting(false);
    }
  }, [visible, marketId]);

  const commentReady = comment.trim().length >= CONCERN_COMMENT_MIN_LENGTH;

  const handleFair = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await onSubmit({ score: 5, fairness: "fair" });
      if (!result.ok) {
        setError(result.error?.message ?? t("submitError"));
        return;
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitConcern = async () => {
    if (!commentReady) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await onSubmit({
        score,
        fairness: "unfair",
        comment: comment.trim(),
      });
      if (!result.ok) {
        setError(result.error?.message ?? t("submitError"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onNotSure}>
      <Pressable
        style={[styles.overlay, { backgroundColor: theme.overlay }]}
        onPress={onNotSure}
      >
        <Pressable
          style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          {step === "initial" ? (
            <>
              <AppText variant="title3" style={styles.centered}>
                {t("feedbackTitle")}
              </AppText>
              {marketQuestion ? (
                <AppText variant="caption" color="secondary" style={styles.centered}>
                  {marketQuestion}
                </AppText>
              ) : null}
              <AppText variant="bodySm" color="secondary" style={styles.centered}>
                {t("feedbackSubtitle")}
              </AppText>
              <AppText
                variant="caption"
                color="primary"
                style={styles.centered}
                onPress={() => router.push("/group-settlements" as never)}
              >
                {t("settlementNoticeLink")}
              </AppText>
              <AppText
                variant="caption"
                color="secondary"
                style={styles.centered}
                onPress={() => router.push("/platform-integrity" as never)}
              >
                {t("integrityNoticeLink")}
              </AppText>
              {error ? (
                <AppText variant="caption" color="destructive" style={styles.centered}>
                  {error}
                </AppText>
              ) : null}
              <View style={styles.actions}>
                <AppButton
                  title={t("feedbackSeemedFair")}
                  loading={submitting}
                  disabled={submitting}
                  onPress={() => void handleFair()}
                />
                <AppButton
                  title={t("feedbackSomethingOff")}
                  variant="secondary"
                  disabled={submitting}
                  onPress={() => setStep("explain")}
                />
                <AppButton
                  title={t("feedbackNotSure")}
                  variant="ghost"
                  disabled={submitting}
                  onPress={onNotSure}
                />
              </View>

              <Pressable
                onPress={onSkip}
                disabled={submitting}
                style={[
                  styles.skip,
                  Platform.OS === "web" ? ({ cursor: "pointer" } as object) : undefined,
                ]}
              >
                <AppText variant="bodySm" color="secondary" style={styles.centered}>
                  {t("feedbackSkip")}
                </AppText>
              </Pressable>
            </>
          ) : null}

          {step === "explain" ? (
            <>
              <AppText variant="title3" style={styles.centered}>
                {t("feedbackExplainTitle")}
              </AppText>
              <AppText variant="bodySm" color="secondary" style={styles.centered}>
                {t("feedbackExplainHint")}
              </AppText>
              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder={t("feedbackExplainPlaceholder")}
                placeholderTextColor={theme.textSecondary}
                multiline
                textAlignVertical="top"
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.border, backgroundColor: theme.input },
                ]}
              />
              <AppText variant="caption" color="secondary">
                {t("feedbackMinLength", {
                  count: CONCERN_COMMENT_MIN_LENGTH,
                  remaining: Math.max(0, CONCERN_COMMENT_MIN_LENGTH - comment.trim().length),
                })}
              </AppText>
              <View style={styles.actions}>
                <AppButton
                  title={t("feedbackContinue")}
                  disabled={!commentReady || submitting}
                  onPress={() => setStep("confirm")}
                />
                <AppButton
                  title={t("feedbackBack")}
                  variant="ghost"
                  disabled={submitting}
                  onPress={() => setStep("initial")}
                />
              </View>
            </>
          ) : null}

          {step === "confirm" ? (
            <>
              <AppText variant="title3" style={styles.centered}>
                {t("feedbackConfirmTitle")}
              </AppText>
              <View style={[styles.commentPreview, { borderColor: theme.border }]}>
                <AppText variant="bodySm" color="secondary">
                  {comment.trim()}
                </AppText>
              </View>
              <AppText
                variant="caption"
                color="primary"
                onPress={() => setStep("explain")}
              >
                {t("feedbackEditComment")}
              </AppText>
              <View style={styles.row}>
                {[1, 2].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setScore(n)}
                    style={[
                      styles.starChip,
                      {
                        borderColor: score === n ? theme.primary : theme.border,
                        backgroundColor: score === n ? theme.primarySoft : "transparent",
                      },
                    ]}
                  >
                    <AppText variant="bodySm" color={score === n ? "primary" : "secondary"}>
                      {n}★
                    </AppText>
                  </Pressable>
                ))}
              </View>
              {error ? (
                <AppText variant="caption" color="destructive">
                  {error}
                </AppText>
              ) : null}
              <View style={styles.actions}>
                <AppButton
                  title={t("feedbackSubmitConcern")}
                  variant="destructive"
                  loading={submitting}
                  disabled={submitting || !commentReady}
                  onPress={() => void handleSubmitConcern()}
                />
                <AppButton
                  title={t("feedbackBack")}
                  variant="ghost"
                  disabled={submitting}
                  onPress={() => setStep("explain")}
                />
              </View>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 12,
    maxWidth: 420,
    width: "100%",
    alignSelf: "center",
  },
  centered: {
    textAlign: "center",
  },
  actions: {
    gap: 8,
    marginTop: 4,
  },
  skip: {
    alignSelf: "center",
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 96,
  },
  commentPreview: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  starChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: "center",
  },
});
