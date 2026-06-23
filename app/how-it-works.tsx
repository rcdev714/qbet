import { SEO } from "@/components/SEO";
import { useTheme } from "@/contexts/ThemeContext";
import { useRouter } from "expo-router";
import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const SECTIONS = [
  {
    title: "Practice first, Live when verified",
    body:
      "AnyMarket is social prediction infrastructure. Use Practice mode to learn with trial credits. Live wallet features unlock only after residence, policy acceptance, age attestation, and KYC verification.",
  },
  {
    title: "Objective markets or no market",
    body:
      "Every market should declare outcomes, close time, resolver, and an objective source of truth. Private groups can create markets among friends; public discovery stays curated and reviewed.",
  },
  {
    title: "Parimutuel pools, not house odds",
    body:
      "Winners share the pool proportionally. AnyMarket facilitates the market protocol and debits your wallet when you participate—it is not a counterparty to individual wagers.",
  },
  {
    title: "Harm prohibition over engagement",
    body:
      "Prohibited categories, automated sports-content detection in Ecuador, manual review, and server-side compliance gates block harmful or high-risk markets before real money moves.",
  },
];

export default function HowItWorksPage() {
  const { theme } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <SEO
        title="How AnyMarket Works"
        description="Learn how Practice mode, Live wallet verification, parimutuel pools, and compliance gates work on AnyMarket."
        url="/how-it-works"
      />
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: theme.primary, marginBottom: 12 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>How AnyMarket Works</Text>
        <Text style={[styles.lead, { color: theme.textSecondary }]}>
          Social prediction infrastructure with backend gates, published market rules, and wallet-tied wager agreements.
        </Text>

        {SECTIONS.map((section) => (
          <View
            key={section.title}
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Text style={[styles.cardTitle, { color: theme.text }]}>{section.title}</Text>
            <Text style={[styles.cardBody, { color: theme.textSecondary }]}>{section.body}</Text>
          </View>
        ))}

        <View style={styles.links}>
          <LinkRow label="Terms of Service" onPress={() => router.push("/terms" as any)} theme={theme} />
          <LinkRow label="Market Rules" onPress={() => router.push("/market-rules" as any)} theme={theme} />
          <LinkRow label="Risk Disclosure" onPress={() => router.push("/risk" as any)} theme={theme} />
          <LinkRow label="Prohibited Markets" onPress={() => router.push("/prohibited-markets" as any)} theme={theme} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LinkRow({
  label,
  onPress,
  theme,
}: {
  label: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.linkRow}>
      <Text style={{ color: theme.primary, fontWeight: '400' }}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, maxWidth: 720, alignSelf: "center", width: "100%" },
  title: { fontSize: 28, fontWeight: "400", marginBottom: 8, letterSpacing: -0.3 },
  lead: { fontSize: 16, lineHeight: 24, marginBottom: 20 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  cardTitle: { fontSize: 18, fontWeight: "400", letterSpacing: -0.2 },
  cardBody: { fontSize: 15, lineHeight: 22 },
  links: { marginTop: 12, gap: 10 },
  linkRow: { paddingVertical: 6 },
});
