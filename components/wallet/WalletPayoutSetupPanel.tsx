import React from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { AppButton, AppText } from "@/components/ui";
import { useTheme } from "@/contexts/ThemeContext";

export type PayoutSetupStepState = "done" | "pending" | "current";

export interface PayoutSetupSteps {
  identity: PayoutSetupStepState;
  profile: PayoutSetupStepState;
  bank: PayoutSetupStepState;
}

interface WalletPayoutSetupPanelProps {
  steps: PayoutSetupSteps;
  loading?: boolean;
  onContinueStripe?: () => void;
  showStripeFallback?: boolean;
}

function StepRow({
  label,
  state,
}: {
  label: string;
  state: PayoutSetupStepState;
}) {
  const { theme } = useTheme();
  const icon =
    state === "done" ? "✓" : state === "current" ? "→" : "○";
  const color =
    state === "done"
      ? theme.primary
      : state === "current"
        ? theme.text
        : theme.textSecondary;

  return (
    <View style={styles.stepRow}>
      <AppText variant="label" style={{ color, width: 18 }}>
        {icon}
      </AppText>
      <AppText variant="bodySm" style={{ color, flex: 1 }}>
        {label}
      </AppText>
    </View>
  );
}

export function WalletPayoutSetupPanel({
  steps,
  loading = false,
  onContinueStripe,
  showStripeFallback = false,
}: WalletPayoutSetupPanelProps) {
  const { theme } = useTheme();
  const { t } = useTranslation("wallet");

  const allDone =
    steps.identity === "done" &&
    steps.profile === "done" &&
    steps.bank === "done";

  if (allDone) return null;

  return (
    <View
      testID="wallet-payout-setup-panel"
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderRadius: theme.radius.lg,
        },
      ]}
    >
      <AppText variant="title3">{t("payoutSetupTitle")}</AppText>
      <AppText variant="bodySm" color="secondary">
        {t("payoutSetupBody")}
      </AppText>
      <View style={styles.steps}>
        <StepRow label={t("payoutStepIdentity")} state={steps.identity} />
        <StepRow label={t("payoutStepProfile")} state={steps.profile} />
        <StepRow label={t("payoutStepBank")} state={steps.bank} />
      </View>
      <AppText variant="caption" color="secondary">
        {t("payoutSettlementNote")}
      </AppText>
      {showStripeFallback && onContinueStripe ? (
        <AppButton
          title={t("payoutContinueStripe")}
          size="sm"
          variant="secondary"
          loading={loading}
          onPress={onContinueStripe}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 10,
  },
  steps: {
    gap: 8,
    marginVertical: 4,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
