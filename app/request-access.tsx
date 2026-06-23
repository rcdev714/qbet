import { CountryPicker } from "@/components/onboarding/CountryPicker";
import { SEO } from "@/components/SEO";
import { AppButton, AppInput, AppScreen, AppText, ErrorBanner, FieldGroup } from "@/components/ui";
import { WhatsAppContactLink } from "@/components/WhatsAppContactLink";
import { useAuthContext } from "@/contexts/AuthContext";
import { saveSubmittedIntent } from "@/lib/beta-access-intent";
import {
    BetaAccessAlreadySubmittedError,
    betaAccessService,
    formatBetaAccessSubmitError,
} from "@/services/betaAccess.service";
import type { SupportedCountryRow } from "@/services/compliance.service";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Platform,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";

const BRAND_DARK_BG = "#030712";
const BRAND_DARK_BORDER = "rgba(255, 255, 255, 0.08)";
const BRAND_PRIMARY = "#3B82F6";
const TEXT_MUTED = "#94A3B8";
const SUCCESS_GREEN = "#10B981";
const ERROR_RED = "#EF4444";
const WARNING_AMBER = "#F59E0B";

type FieldErrors = {
  email?: boolean;
  fullName?: boolean;
  country?: boolean;
};

function StatusBanner({
  variant,
  title,
  body,
  onDismiss,
  dismissLabel,
}: {
  variant: "success" | "error" | "warning" | "info";
  title: string;
  body?: string;
  onDismiss?: () => void;
  dismissLabel?: string;
}) {
  const palette = {
    success: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.35)", icon: SUCCESS_GREEN },
    error: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.35)", icon: ERROR_RED },
    warning: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.35)", icon: WARNING_AMBER },
    info: { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.35)", icon: BRAND_PRIMARY },
  }[variant];

  const iconName =
    variant === "success"
      ? "checkmark-circle"
      : variant === "error"
        ? "alert-circle"
        : variant === "warning"
          ? "warning"
          : "information-circle";

  return (
    <View style={[styles.banner, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Ionicons name={iconName} size={22} color={palette.icon} style={styles.bannerIcon} />
      <View style={styles.bannerText}>
        <AppText variant="body" style={{ color: "#F8FAFC" }}>{title}</AppText>
        {body ? <AppText variant="bodySm" color="secondary">{body}</AppText> : null}
        {onDismiss && dismissLabel ? (
          <TouchableOpacity
            onPress={onDismiss}
            style={[styles.bannerDismiss, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
            activeOpacity={0.85}
          >
            <AppText variant="label" style={{ color: palette.icon }}>{dismissLabel}</AppText>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export default function RequestAccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuthContext();
  const { t } = useTranslation("accessRequest");

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<SupportedCountryRow | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    const prefillEmail = typeof params.email === "string" ? params.email : user?.email;
    if (prefillEmail) {
      setEmail(prefillEmail);
    }
  }, [params.email, user?.email]);

  const clearErrors = () => {
    setSubmitError(null);
    setFieldErrors({});
  };

  const handleSubmit = async () => {
    clearErrors();

    const nextFieldErrors: FieldErrors = {};
    if (!email.trim()) nextFieldErrors.email = true;
    if (!fullName.trim()) nextFieldErrors.fullName = true;
    if (!selectedCountry) nextFieldErrors.country = true;

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setSubmitError(t("validationHint"));
      return;
    }

    setSubmitting(true);
    const trimmedEmail = email.trim();
    try {
      const requestId = await betaAccessService.submitRequest({
        email: trimmedEmail,
        fullName: fullName.trim(),
        countryCode: selectedCountry!.country_code,
        message: message.trim() || null,
      });
      await saveSubmittedIntent(trimmedEmail, requestId);
      setSubmittedEmail(trimmedEmail);
      setSubmitted(true);
    } catch (error) {
      if (error instanceof BetaAccessAlreadySubmittedError) {
        setSubmittedEmail(trimmedEmail);
        await saveSubmittedIntent(trimmedEmail);
        setAlreadySubmitted(true);
        return;
      }
      setSubmitError(formatBetaAccessSubmitError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const showSuccess = submitted || alreadySubmitted;

  return (
    <View style={styles.container}>
      <SEO title={t("seoTitle")} description={t("seoDescription")} url="/request-access" />
      <AppScreen scroll scrollProps={{ contentContainerStyle: styles.scroll }}>
          <TouchableOpacity
            onPress={() => router.push("/")}
            style={[styles.backLink, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={18} color={TEXT_MUTED} />
            <AppText variant="label" color="secondary">{t("backHome")}</AppText>
          </TouchableOpacity>

          <View style={styles.card}>
            {showSuccess ? (
              <>
                <StatusBanner
                  variant={alreadySubmitted ? "info" : "success"}
                  title={alreadySubmitted ? t("alreadySubmittedTitle") : t("successTitle")}
                  body={
                    alreadySubmitted
                      ? t("alreadySubmittedBody")
                      : t("successEmailNote", { email: submittedEmail })
                  }
                />
                {!alreadySubmitted ? (
                  <AppButton
                    title={t("signUp")}
                    onPress={() => router.push("/login?mode=signup")}
                    style={styles.submitButton}
                  />
                ) : null}
                <View style={styles.contactRow}>
                  <AppText variant="bodySm" color="secondary">{t("questions")}</AppText>
                  <WhatsAppContactLink iconSize={18} />
                </View>
              </>
            ) : (
              <>
                <AppText variant="title1" style={styles.title}>{t("title")}</AppText>
                <AppText variant="body" color="secondary" style={styles.subtitle}>{t("subtitle")}</AppText>

                {submitError ? (
                  <ErrorBanner
                    message={submitError}
                    onRetry={clearErrors}
                    retryLabel={t("tryAgain")}
                  />
                ) : null}

                <FieldGroup>
                  <AppInput
                    testID="access-email"
                    label={t("emailLabel")}
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      if (fieldErrors.email) setFieldErrors((e) => ({ ...e, email: false }));
                    }}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    placeholder={t("emailPlaceholder")}
                    error={fieldErrors.email ? t("validationHint") : undefined}
                  />

                  <AppInput
                    testID="access-name"
                    label={t("nameLabel")}
                    value={fullName}
                    onChangeText={(value) => {
                      setFullName(value);
                      if (fieldErrors.fullName) setFieldErrors((e) => ({ ...e, fullName: false }));
                    }}
                    autoComplete="name"
                    placeholder={t("namePlaceholder")}
                    error={fieldErrors.fullName ? t("validationHint") : undefined}
                  />

                  <View style={styles.field}>
                    <AppText variant="label">{t("countryLabel")}</AppText>
                    {fieldErrors.country ? (
                      <AppText variant="caption" color="destructive">{t("countryRequired")}</AppText>
                    ) : null}
                    <CountryPicker
                      testID="access-country-trigger"
                      variant="dark"
                      selectedCountry={selectedCountry?.country_code ?? null}
                      onSelect={(country) => {
                        setSelectedCountry(country);
                        if (fieldErrors.country) setFieldErrors((e) => ({ ...e, country: false }));
                      }}
                    />
                  </View>

                  <AppInput
                    label={t("messageLabel")}
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    numberOfLines={4}
                    placeholder={t("messagePlaceholder")}
                    style={styles.textArea}
                  />
                </FieldGroup>

                <AppButton
                  testID="access-submit"
                  title={t("submit")}
                  loading={submitting}
                  onPress={() => void handleSubmit()}
                  style={styles.submitButton}
                />

                <View style={styles.contactRow}>
                  <AppText variant="bodySm" color="secondary">{t("questions")}</AppText>
                  <WhatsAppContactLink iconSize={18} />
                </View>
              </>
            )}
          </View>
      </AppScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND_DARK_BG,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    maxWidth: 560,
    width: "100%",
    alignSelf: "center",
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 20,
  },
  backLinkText: {
    color: TEXT_MUTED,
    fontSize: 14,
    fontWeight: "500",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_DARK_BORDER,
    padding: 28,
    gap: 16,
  },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bannerIcon: {
    marginTop: 1,
  },
  bannerText: {
    flex: 1,
    gap: 4,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '400',
  },
  bannerBody: {
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_MUTED,
  },
  bannerDismiss: {
    alignSelf: "flex-start",
    marginTop: 6,
  },
  bannerDismissText: {
    fontSize: 14,
    fontWeight: '400',
  },
  title: {
    fontSize: 26,
    fontWeight: "400",
    color: "#F8FAFC",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: TEXT_MUTED,
    textAlign: "center",
    marginBottom: 4,
  },
  field: {
    gap: 8,
  },
  fieldError: {
    fontSize: 13,
    color: ERROR_RED,
    fontWeight: "500",
  },
  label: {
    fontSize: 13,
    fontWeight: '400',
    color: "rgba(248,250,252,0.85)",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  input: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#F8FAFC",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
  },
  textArea: {
    minHeight: 112,
    textAlignVertical: "top",
  },
  submitButton: {
    marginTop: 4,
  },
  contactRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  contactLabel: {
    color: TEXT_MUTED,
    fontSize: 14,
  },
});
