import { SEO } from "@/components/SEO";
import { AppButton } from "@/components/ui/AppButton";
import { AppScreen } from "@/components/ui/AppScreen";
import { AppText } from "@/components/ui/AppText";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useWalletContext } from "@/contexts/WalletContext";
import { getParamString } from "@/lib/route-params";
import { showAppAlertRaw } from "@/lib/ui/feedback";
import { complianceService } from "@/services/compliance.service";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Platform, StyleSheet, TouchableOpacity, View, Alert } from "react-native";

export default function WalletVerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ kyc?: string }>();
  const kycReturn = getParamString(params.kyc) === "return";
  const { user } = useAuthContext();
  const { theme } = useTheme();
  const { t } = useTranslation("wallet");
  const { liveWalletReady, refreshComplianceProfile, refresh, requestLiveMode } = useWalletContext();
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  const pollStatus = useCallback(async () => {
    setPolling(true);
    try {
      const profile = await refreshComplianceProfile();
      if (profile?.kyc_status === "verified" && profile.live_wallet_enabled) {
        await refresh();
        await requestLiveMode();
        Alert.alert(t("verifySuccessTitle"), t("verifySuccessBody"), [
          { text: t("verifyContinue"), onPress: () => router.replace("/(tabs)/wallet" as any) },
        ]);
      }
    } finally {
      setPolling(false);
    }
  }, [refresh, refreshComplianceProfile, requestLiveMode, router, t]);

  useEffect(() => {
    if (kycReturn) {
      void pollStatus();
    }
  }, [kycReturn, pollStatus]);

  useEffect(() => {
    if (liveWalletReady) {
      void requestLiveMode();
      router.replace("/(tabs)/wallet" as any);
    }
  }, [liveWalletReady, requestLiveMode, router]);

  const startVerification = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const session = await complianceService.startStripeIdentity();
      if (session.url) {
        await Linking.openURL(session.url);
      } else {
        showAppAlertRaw(t("verifyUrlMissingTitle"), t("verifyUrlMissingBody"));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("verifyErrorBody");
      showAppAlertRaw(t("verifyErrorTitle"), message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SEO title={t("verifySeoTitle")} description={t("verifySeoDescription")} url="/wallet/verify" noindex />
      <AppScreen maxWidth="narrow" style={styles.screen}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <AppText variant="title2" style={{ textAlign: "center" }}>{t("verifyPageTitle")}</AppText>
          <AppText variant="body" color="secondary" style={{ textAlign: "center", lineHeight: 22 }}>
            {t("verifyPageDescription")}
          </AppText>

          <AppButton
            testID="kyc-start"
            title={t("verifyStart")}
            onPress={startVerification}
            loading={loading}
            disabled={loading}
          />

          <AppButton
            testID="kyc-poll-status"
            title={t("verifyCheckStatus")}
            variant="secondary"
            onPress={pollStatus}
            loading={polling}
            disabled={polling}
          />

          <TouchableOpacity
            onPress={() => router.back()}
            style={[Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
          >
            <AppText variant="bodySm" color="secondary" style={{ textAlign: "center" }}>
              {t("verifyBack")}
            </AppText>
          </TouchableOpacity>
        </View>
      </AppScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  screen: { flex: 1, justifyContent: "center" },
  card: {
    width: "100%",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    gap: 16,
  },
});
