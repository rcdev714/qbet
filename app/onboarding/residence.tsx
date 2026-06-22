import { CountryPicker } from "@/components/onboarding/CountryPicker";
import { PhoneInput } from "@/components/onboarding/PhoneInput";
import { SEO } from "@/components/SEO";
import { getResidenceFrameworkNotice } from "@/lib/compliance/jurisdiction";
import type { SupportedCountryRow } from "@/services/compliance.service";
import { complianceService } from "@/services/compliance.service";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

export default function ResidenceOnboardingScreen() {
  const router = useRouter();
  const [selectedCountry, setSelectedCountry] = useState<SupportedCountryRow | null>(null);
  const [phoneDisplay, setPhoneDisplay] = useState("");
  const [phoneE164, setPhoneE164] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const frameworkNotice = useMemo(
    () => (selectedCountry ? getResidenceFrameworkNotice(selectedCountry.country_code) : null),
    [selectedCountry],
  );

  const handleContinue = async () => {
    if (!selectedCountry) {
      Alert.alert("Country required", "Select your country of residence to continue.");
      return;
    }

    setSubmitting(true);
    try {
      await complianceService.setUserResidence({
        country: selectedCountry.country_code,
        phoneE164,
      });
      router.replace("/onboarding/policies" as any);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save your residence.";
      Alert.alert("Something went wrong", message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <SEO
        title="Country of Residence"
        description="Set your country of residence for AnyMarket compliance and payments."
        url="/onboarding/residence"
        noindex
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.card}>
          <Text style={styles.title}>Where do you live?</Text>
          <Text style={styles.subtitle}>
            This sets your legal framework and payment country. It cannot be changed later in the app
            because it is tied to your Stripe payment profile.
          </Text>

          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              Need a change later? Contact support@anymarket.app — country updates require a new
              payment setup.
            </Text>
          </View>

          <CountryPicker
            selectedCountry={selectedCountry?.country_code}
            onSelect={setSelectedCountry}
            variant="light"
          />

          {frameworkNotice ? (
            <Text style={styles.frameworkNotice}>{frameworkNotice}</Text>
          ) : null}

          <PhoneInput
            country={selectedCountry}
            value={phoneDisplay}
            onChange={(display, e164) => {
              setPhoneDisplay(display);
              setPhoneE164(e164);
            }}
            variant="light"
          />

          <TouchableOpacity
            style={[styles.button, (!selectedCountry || submitting) && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!selectedCountry || submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
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
  safeArea: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    maxWidth: 560,
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
  notice: {
    backgroundColor: "rgba(0, 144, 255, 0.08)",
    borderRadius: 12,
    padding: 12,
  },
  noticeText: {
    color: "#1A2F5C",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  frameworkNotice: {
    color: "#2A5BFF",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  button: {
    marginTop: 4,
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
