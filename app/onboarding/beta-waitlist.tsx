import { SEO } from "@/components/SEO";
import { AppButton } from "@/components/ui/AppButton";
import { WhatsAppContactLink } from "@/components/WhatsAppContactLink";
import { Brand } from "@/constants/theme";
import { useAuthContext } from "@/contexts/AuthContext";
import { useOnboardingGuard } from "@/contexts/OnboardingGuardContext";
import { betaAccessService, type BetaAccessRequest } from "@/services/betaAccess.service";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AppState, SafeAreaView, StyleSheet, Text, View } from "react-native";

const POLL_MS = 30_000;

export default function BetaWaitlistScreen() {
  const { user, signOut } = useAuthContext();
  const { refreshOnboardingStatus } = useOnboardingGuard();
  const router = useRouter();
  const { t } = useTranslation("onboarding");
  const { t: tAccess } = useTranslation("accessRequest");

  const [request, setRequest] = useState<BetaAccessRequest | null>(null);
  const [loadingRequest, setLoadingRequest] = useState(true);

  const loadRequest = useCallback(async () => {
    const email = user?.email;
    if (!email) {
      setLoadingRequest(false);
      return;
    }
    try {
      const row = await betaAccessService.getRequestByEmail(email);
      setRequest(row);
      if (row?.status === "approved") {
        await refreshOnboardingStatus();
      }
    } catch {
      // ignore — show default waitlist UI
    } finally {
      setLoadingRequest(false);
    }
  }, [refreshOnboardingStatus, user?.email]);

  useEffect(() => {
    void loadRequest();
  }, [loadRequest]);

  useEffect(() => {
    if (!user?.email || request?.status !== "pending") return;

    const interval = setInterval(() => {
      void loadRequest();
    }, POLL_MS);

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void loadRequest();
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [loadRequest, request?.status, user?.email]);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      Alert.alert(t("saveError"), error.message);
    }
  };

  const handleContinueOnboarding = () => {
    router.replace("/onboarding/residence" as any);
  };

  const hasPendingRequest = request?.status === "pending";
  const hasDeclinedRequest = request?.status === "declined";
  const hasApprovedRequest = request?.status === "approved";

  return (
    <View style={styles.container}>
      <SEO
        title={t("betaWaitlistSeoTitle")}
        description={t("betaWaitlistSeoDescription")}
        url="/onboarding/beta-waitlist"
        noindex
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.card}>
          <Text style={styles.title}>{t("betaWaitlistTitle")}</Text>
          <Text style={styles.body}>
            {t("betaWaitlistBody", { email: user?.email ?? "" })}
          </Text>

          {hasApprovedRequest ? (
            <View style={[styles.statusBox, styles.approvedBox]}>
              <Text style={styles.approvedTitle}>{tAccess("approvedTitle")}</Text>
              <Text style={styles.body}>{tAccess("approvedWaitlistBody")}</Text>
              <AppButton
                title={tAccess("continueOnboarding")}
                onPress={handleContinueOnboarding}
                style={styles.requestButton}
              />
            </View>
          ) : hasPendingRequest ? (
            <View style={styles.statusBox}>
              <Text style={styles.statusTitle}>{tAccess("requestReceived")}</Text>
              <Text style={styles.body}>{tAccess("pendingStatus")}</Text>
              <Text style={styles.hint}>{tAccess("checkEmailForLink")}</Text>
            </View>
          ) : hasDeclinedRequest ? (
            <View style={styles.statusBox}>
              <Text style={styles.body}>{tAccess("declinedStatus")}</Text>
            </View>
          ) : !loadingRequest ? (
            <AppButton
              title={tAccess("requestAccess")}
              onPress={() =>
                router.push({
                  pathname: "/request-access",
                  params: user?.email ? { email: user.email } : undefined,
                } as any)
              }
              style={styles.requestButton}
            />
          ) : null}

          <View style={styles.contactRow}>
            <Text style={styles.body}>{t("betaWaitlistNeedAccess")}</Text>
            <WhatsAppContactLink iconSize={18} />
          </View>
          <Text style={styles.link} onPress={() => void handleSignOut()}>
            {t("betaWaitlistSignOut")}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FB" },
  safeArea: { flex: 1, justifyContent: "center", padding: 24 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    gap: 12,
    maxWidth: 480,
    alignSelf: "center",
    width: "100%",
  },
  title: { fontSize: 22, fontWeight: '400', color: Brand.deep, textAlign: "center" },
  body: { fontSize: 15, lineHeight: 22, color: Brand.mutedText, textAlign: "center" },
  statusBox: {
    gap: 6,
    paddingVertical: 4,
  },
  approvedBox: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderRadius: 12,
    padding: 12,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '400',
    color: Brand.deep,
    textAlign: "center",
  },
  approvedTitle: {
    fontSize: 16,
    fontWeight: '400',
    color: "#059669",
    textAlign: "center",
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    color: Brand.mutedText,
    textAlign: "center",
    marginTop: 4,
  },
  requestButton: {
    marginTop: 4,
  },
  contactRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  link: { marginTop: 8, textAlign: "center", color: Brand.primary, fontWeight: '400' },
});
