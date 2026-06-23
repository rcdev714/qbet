import { CountryPicker } from "@/components/onboarding/CountryPicker";
import { PhoneInput } from "@/components/onboarding/PhoneInput";
import { SEO } from "@/components/SEO";
import { Brand, Colors } from "@/constants/theme";
import { useAppLocale } from "@/contexts/LocaleContext";
import { useOnboardingGuard } from "@/contexts/OnboardingGuardContext";
import { getPublicEnv } from "@/lib/public-env";
import type { SupportedCountryRow } from "@/services/compliance.service";
import { complianceService } from "@/services/compliance.service";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("onboarding");
  const { setPreviewCountryCode, refreshResidence } = useAppLocale();
  const { refreshOnboardingStatus } = useOnboardingGuard();
  const [selectedCountry, setSelectedCountry] = useState<SupportedCountryRow | null>(null);
  const [phoneDisplay, setPhoneDisplay] = useState("");
  const [phoneE164, setPhoneE164] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const frameworkNotice = useMemo(() => {
    if (!selectedCountry) return null;
    return selectedCountry.country_code.toUpperCase() === "EC"
      ? t("frameworkNoticeEc")
      : t("frameworkNoticeUs");
  }, [selectedCountry, t]);

  const handleCountryChange = (country: SupportedCountryRow | null) => {
    setSelectedCountry(country);
    setPreviewCountryCode(country?.country_code ?? null);
  };

  const handleContinue = async () => {
    const launchJurisdiction = getPublicEnv().launchJurisdiction.toUpperCase();
    const countryName = t(`common:countries.${launchJurisdiction}`, {
      defaultValue: launchJurisdiction,
    });
    if (
      launchJurisdiction &&
      selectedCountry &&
      selectedCountry.country_code !== launchJurisdiction
    ) {
      Alert.alert(
        t("betaNotAvailable"),
        t("betaLimited", { country: countryName }),
      );
      return;
    }

    if (!selectedCountry) {
      Alert.alert(t("countryRequired"), t("countryRequiredBody"));
      return;
    }

    setSubmitting(true);
    try {
      await complianceService.setUserResidence({
        country: selectedCountry.country_code,
        phoneE164,
      });
      await refreshResidence();
      setPreviewCountryCode(null);
      await refreshOnboardingStatus();
      router.replace("/onboarding/policies" as any);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("saveError");
      Alert.alert(t("saveError"), message);
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
          <Text style={styles.title}>{t("residenceTitle")}</Text>
          <Text style={styles.subtitle}>{t("residenceSubtitle")}</Text>

          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              Need a change later? Contact support@anymarket.app — country updates require a new
              payment setup.
            </Text>
          </View>

          <CountryPicker
            testID="residence-country-trigger"
            selectedCountry={selectedCountry?.country_code}
            onSelect={handleCountryChange}
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
            testID="residence-continue"
            style={[styles.button, (!selectedCountry || submitting) && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!selectedCountry || submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t("common:continue")}</Text>
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
    backgroundColor: Colors.light.background,
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
    color: Brand.deep,
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
  },
  subtitle: {
    color: Brand.mutedText,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  notice: {
    backgroundColor: `${Brand.primary}14`,
    borderRadius: 12,
    padding: 12,
  },
  noticeText: {
    color: Brand.deep,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  frameworkNotice: {
    color: Brand.primary,
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
    backgroundColor: Brand.primary,
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
