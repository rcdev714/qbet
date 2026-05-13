import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface WalletOnboardingCardProps {
  state: "ready" | "needs_identity" | "pending_review";
  loading?: boolean;
  onContinue: () => void;
  theme: {
    surface: string;
    border: string;
    text: string;
    textSecondary: string;
    primary: string;
  };
}

export function WalletOnboardingCard({
  state,
  loading = false,
  onContinue,
  theme,
}: WalletOnboardingCardProps) {
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
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.body, { color: theme.textSecondary }]}>{body}</Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.primary }]}
        disabled={loading}
        onPress={onContinue}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{cta}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 6,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  button: {
    borderRadius: 10,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
});
