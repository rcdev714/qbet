import { SEO } from "@/components/SEO";
import { AppButton, AppReveal, AppScreen, AppText, EmptyState } from "@/components/ui";
import { saveApprovedIntent } from "@/lib/beta-access-intent";
import { getParamString } from "@/lib/route-params";
import { betaAccessService } from "@/services/betaAccess.service";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, View } from "react-native";

const BRAND_PRIMARY = "#3B82F6";

export default function BetaWelcomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { t } = useTranslation("accessRequest");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const token = getParamString(params.token);
    if (!token) {
      setError(t("invalidApprovalLink"));
      setLoading(false);
      return;
    }

    betaAccessService
      .resolveApprovalToken(token)
      .then(async (resolved) => {
        if (!mounted) return;
        if (!resolved) {
          setError(t("invalidApprovalLink"));
          return;
        }
        setEmail(resolved.email);
        await saveApprovedIntent({
          email: resolved.email,
          requestId: resolved.request_id,
          approvalToken: token,
        });
      })
      .catch(() => {
        if (mounted) setError(t("invalidApprovalLink"));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [params.token, t]);

  return (
    <View style={styles.container}>
      <SEO title={t("approvedTitle")} description={t("approvedBody")} url="/beta/welcome" noindex />
      <AppScreen style={styles.safeArea}>
        <View style={styles.card}>
          {loading ? (
            <ActivityIndicator size="large" color={BRAND_PRIMARY} />
          ) : error ? (
            <EmptyState
              icon="alert-circle-outline"
              title={t("errorTitle")}
              description={error}
              actionLabel={t("requestAccess")}
              onAction={() => router.push("/request-access")}
              variant="destructive"
            />
          ) : (
            <AppReveal>
              <Ionicons name="checkmark-circle-outline" size={48} color={BRAND_PRIMARY} style={styles.icon} />
              <AppText variant="title1" style={styles.title}>{t("approvedTitle")}</AppText>
              <AppText variant="body" color="secondary" style={styles.subtitle}>
                {t("approvedWelcomeBody", { email: email ?? "" })}
              </AppText>
              <AppButton
                title={t("signUp")}
                onPress={() =>
                  router.push({
                    pathname: "/login",
                    params: { mode: "signup", email: email ?? undefined },
                  } as any)
                }
                style={styles.button}
              />
              <AppButton
                title={t("signInInstead")}
                variant="ghost"
                onPress={() =>
                  router.push({
                    pathname: "/login",
                    params: { email: email ?? undefined },
                  } as any)
                }
              />
            </AppReveal>
          )}
        </View>
      </AppScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, justifyContent: "center" },
  card: {
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 28,
    gap: 16,
    alignItems: "center",
  },
  icon: { marginBottom: 4 },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
  },
  button: { alignSelf: "stretch" },
});
