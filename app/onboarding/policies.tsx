import { PolicyConsentBlock } from "@/components/legal/PolicyConsentBlock";
import { SEO } from "@/components/SEO";
import { Brand, Colors } from "@/constants/theme";
import { useAuthContext } from "@/contexts/AuthContext";
import { useAppLocale } from "@/contexts/LocaleContext";
import { useOnboardingGuard } from "@/contexts/OnboardingGuardContext";
import { complianceService } from "@/services/compliance.service";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function PolicyOnboardingScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { refreshOnboardingStatus } = useOnboardingGuard();
  const { locale } = useAppLocale();
  const { t } = useTranslation("onboarding");
  const { t: tCompliance } = useTranslation("compliance");
  const [accepted, setAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingResidence, setLoadingResidence] = useState(true);
  const [jurisdiction, setJurisdiction] = useState<"EC" | "US">("US");
  const [countryName, setCountryName] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState<string | null>(null);

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
        setCountryCode(residence.country_of_residence);
      })
      .finally(() => {
        if (mounted) setLoadingResidence(false);
      });
    return () => {
      mounted = false;
    };
  }, [router]);

  const handleContinue = async () => {
    if (!ageConfirmed) {
      Alert.alert(t("ageRequired"), t("ageRequiredBody"));
      return;
    }
    if (!accepted) {
      Alert.alert(t("agreementRequired"), t("agreementRequiredBody"));
      return;
    }

    setSubmitting(true);
    try {
      await complianceService.recordAgeAttestation();
      await complianceService.acceptCurrentPolicies("onboarding", jurisdiction);
      await refreshOnboardingStatus();
      router.replace("/(tabs)/feed" as any);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("savePoliciesError");
      Alert.alert(t("saveError"), message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingResidence) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={Brand.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SEO
        title={t("policiesTitle")}
        description={t("policiesSubtitle")}
        url="/onboarding/policies"
        noindex
        locale={locale === "es" ? "es_ES" : "en_US"}
      />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
          <Text style={styles.title}>{t("policiesBeforeContinue")}</Text>
          <Text style={styles.subtitle}>
            {user?.username ? t("policiesWelcome", { username: user.username }) : ""}
            {t("policiesReview")}
          </Text>

          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>
              {jurisdiction === "EC" ? tCompliance("frameworkEc") : tCompliance("frameworkUs")}
            </Text>
            <Text style={styles.bannerBody}>
              {t("policiesCountryBanner", { country: countryName ?? "" })}
            </Text>
          </View>

          <PolicyConsentBlock
            testID="policies-consent-checkbox"
            accepted={accepted}
            onAcceptedChange={setAccepted}
            jurisdiction={jurisdiction}
            countryCode={countryCode}
            variant="light"
          />

          <TouchableOpacity
            testID="policies-age-checkbox"
            style={styles.ageRow}
            onPress={() => setAgeConfirmed(!ageConfirmed)}
            activeOpacity={0.75}
          >
            <View style={[styles.ageCheckbox, ageConfirmed && styles.ageCheckboxChecked]}>
              {ageConfirmed ? <Text style={styles.ageCheckmark}>✓</Text> : null}
            </View>
            <Text style={styles.ageLabel}>{t("ageConfirm")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="policies-continue"
            style={[styles.button, (!accepted || !ageConfirmed || submitting) && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!accepted || !ageConfirmed || submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t("acceptContinue")}</Text>
            )}
          </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
    color: Brand.deep,
    fontSize: 24,
    fontWeight: '400',
    textAlign: "center",
  },
  subtitle: {
    color: Brand.mutedText,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  banner: {
    backgroundColor: `${Brand.primary}14`,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  bannerTitle: {
    color: Brand.deep,
    fontSize: 14,
    fontWeight: '400',
    textAlign: "center",
  },
  bannerBody: {
    color: Brand.mutedText,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  ageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 2,
  },
  ageCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.25,
    borderColor: "rgba(15, 23, 42, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  ageCheckboxChecked: {
    backgroundColor: Brand.primary,
    borderColor: Brand.primary,
  },
  ageCheckmark: {
    color: "#fff",
    fontSize: 12,
    fontWeight: '400',
  },
  ageLabel: {
    flex: 1,
    color: Brand.mutedText,
    fontSize: 13,
    lineHeight: 19,
  },
  button: {
    marginTop: 8,
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
    fontWeight: '400',
  },
});
