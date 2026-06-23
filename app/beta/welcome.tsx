import { SEO } from "@/components/SEO";
import { AppButton } from "@/components/ui/AppButton";
import { saveApprovedIntent } from "@/lib/beta-access-intent";
import { getParamString } from "@/lib/route-params";
import { betaAccessService } from "@/services/betaAccess.service";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const BRAND_DARK_BG = "#030712";
const BRAND_PRIMARY = "#3B82F6";
const TEXT_MUTED = "#94A3B8";

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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.card}>
          {loading ? (
            <ActivityIndicator size="large" color={BRAND_PRIMARY} />
          ) : error ? (
            <>
              <Ionicons name="alert-circle-outline" size={48} color="#EF4444" style={styles.icon} />
              <Text style={styles.title}>{t("errorTitle")}</Text>
              <Text style={styles.subtitle}>{error}</Text>
              <AppButton title={t("requestAccess")} onPress={() => router.push("/request-access")} />
            </>
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={48} color={BRAND_PRIMARY} style={styles.icon} />
              <Text style={styles.title}>{t("approvedTitle")}</Text>
              <Text style={styles.subtitle}>{t("approvedWelcomeBody", { email: email ?? "" })}</Text>
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
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/login",
                    params: { email: email ?? undefined },
                  } as any)
                }
                style={[styles.secondaryLink, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
              >
                <Text style={styles.secondaryLinkText}>{t("signInInstead")}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND_DARK_BG },
  safeArea: { flex: 1, justifyContent: "center", padding: 24 },
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
    fontSize: 24,
    fontWeight: "700",
    color: "#F8FAFC",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: TEXT_MUTED,
    textAlign: "center",
  },
  button: { alignSelf: "stretch" },
  secondaryLink: { paddingVertical: 8 },
  secondaryLinkText: {
    color: BRAND_PRIMARY,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
});
