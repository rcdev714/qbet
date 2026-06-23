import { SEO } from "@/components/SEO";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useWalletContext } from "@/contexts/WalletContext";
import { getParamString } from "@/lib/route-params";
import { complianceService } from "@/services/compliance.service";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

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
        Alert.alert(t("verifyUrlMissingTitle"), t("verifyUrlMissingBody"));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("verifyErrorBody");
      Alert.alert(t("verifyErrorTitle"), message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SEO title={t("verifySeoTitle")} description={t("verifySeoDescription")} url="/wallet/verify" noindex />
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>{t("verifyPageTitle")}</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            {t("verifyPageDescription")}
          </Text>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primary }, loading && styles.disabled]}
            onPress={startVerification}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>{t("verifyStart")}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: theme.border }, polling && styles.disabled]}
            onPress={pollStatus}
            disabled={polling}
          >
            {polling ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>{t("verifyCheckStatus")}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            style={[Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
          >
            <Text style={[styles.backText, { color: theme.textSecondary }]}>{t("verifyBack")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, justifyContent: "center", padding: 24 },
  card: {
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    gap: 16,
  },
  title: { fontSize: 22, fontWeight: "600", textAlign: "center" },
  body: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryButtonText: { fontWeight: "600", fontSize: 15 },
  backText: { textAlign: "center", fontSize: 14 },
  disabled: { opacity: 0.7 },
});
