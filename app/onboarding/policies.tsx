import { PolicyConsentBlock } from "@/components/legal/PolicyConsentBlock";
import { SEO } from "@/components/SEO";
import { useAuthContext } from "@/contexts/AuthContext";
import { getJurisdictionLabel } from "@/lib/compliance/jurisdiction";
import { complianceService } from "@/services/compliance.service";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function PolicyOnboardingScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingResidence, setLoadingResidence] = useState(true);
  const [jurisdiction, setJurisdiction] = useState<"EC" | "US">("US");
  const [countryName, setCountryName] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    complianceService
      .getUserResidence()
      .then((residence) => {
        if (!mounted) return;
        if (!residence?.country_of_residence) {
          router.replace("/onboarding/residence" as any);
          return;
        }
        setJurisdiction(residence.jurisdiction);
        setCountryName(residence.country_name ?? residence.country_of_residence);
      })
      .finally(() => {
        if (mounted) setLoadingResidence(false);
      });
    return () => {
      mounted = false;
    };
  }, [router]);

  const handleContinue = async () => {
    if (!accepted) {
      Alert.alert("Agreement required", "Accept all required policies to continue.");
      return;
    }

    setSubmitting(true);
    try {
      await complianceService.acceptCurrentPolicies("onboarding", jurisdiction);
      router.replace("/(tabs)" as any);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save your policy acceptance.";
      Alert.alert("Something went wrong", message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingResidence) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color="#0090FF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SEO
        title="Accept Required Policies"
        description="Review and accept AnyMarket policies to continue."
        url="/onboarding/policies"
        noindex
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.card}>
          <Text style={styles.title}>Before you continue</Text>
          <Text style={styles.subtitle}>
            {user?.username ? `Welcome, ${user.username}. ` : ""}
            Review and accept the policies that apply to your account.
          </Text>

          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>{getJurisdictionLabel(jurisdiction)}</Text>
            <Text style={styles.bannerBody}>
              Country of residence: {countryName}. These policies match your selected framework.
            </Text>
          </View>

          <PolicyConsentBlock
            accepted={accepted}
            onAcceptedChange={setAccepted}
            jurisdiction={jurisdiction}
            variant="light"
          />

          <TouchableOpacity
            style={[styles.button, (!accepted || submitting) && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!accepted || submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Accept and continue</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  safeArea: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    gap: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(15, 23, 42, 0.08)",
  },
  title: {
    color: "#1A2F5C",
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
  },
  subtitle: {
    color: "#526173",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  banner: {
    backgroundColor: "rgba(42, 91, 255, 0.08)",
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  bannerTitle: {
    color: "#1A2F5C",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  bannerBody: {
    color: "#526173",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  button: {
    marginTop: 8,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0090FF",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
