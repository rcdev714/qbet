import React from "react";
import { StyleSheet, View } from "react-native";

import { AppButton, AppText } from "@/components/ui";
import { useTheme } from "@/contexts/ThemeContext";

interface WalletOnboardingCardProps {
  state: "ready" | "needs_identity" | "pending_review";
  loading?: boolean;
  onContinue: () => void;
}

export function WalletOnboardingCard({
  state,
  loading = false,
  onContinue,
}: WalletOnboardingCardProps) {
  const { theme } = useTheme();

  if (state === "ready") return null;

  const isPending = state === "pending_review";
  const title = isPending ? "Verification in progress" : "Finish wallet setup";
  const body = isPending
    ? "Stripe is reviewing your details. Withdrawals and transfers will unlock shortly."
    : "Complete Stripe onboarding once to enable withdrawals and person-to-person sends.";
  const cta = isPending ? "Check again" : "Continue setup";

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: theme.radius.lg },
      ]}
    >
      <AppText variant="title3">{title}</AppText>
      <AppText variant="bodySm" color="secondary">
        {body}
      </AppText>
      <AppButton title={cta} size="sm" loading={loading} onPress={onContinue} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 14,
    gap: 8,
  },
});
