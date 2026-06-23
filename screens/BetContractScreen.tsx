import { AppScreen } from "@/components/ui/AppScreen";
import { AppSkeleton } from "@/components/ui/AppSkeleton";
import { AppText } from "@/components/ui/AppText";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Brand } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import type { BetContractDiagnosis } from "@/lib/bet-contract-diagnostics";
import {
    parseBetContractResolution,
    parseBetContractSnapshot,
    type BetContractRecord,
} from "@/lib/legal/bet-contract";
import {
    buildBetContractHtml,
    buildBetContractPlainText,
} from "@/lib/legal/bet-contract-document";
import { getPublicEnv } from "@/lib/public-env";
import { getParamString } from "@/lib/route-params";
import { showAppAlertRaw } from "@/lib/ui/feedback";
import { betContractService } from "@/services/betContract.service";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Linking,
    Platform,
    Share,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";

type DebugEntry = {
  at: string;
  action: string;
  detail?: string;
};

export function BetContractScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ betId: string }>();
  const betId = getParamString(params.betId);
  const { theme } = useTheme();
  const { t } = useTranslation("contract");
  const [contract, setContract] = useState<BetContractRecord | null>(null);
  const [diagnosis, setDiagnosis] = useState<BetContractDiagnosis | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState<"placed" | "resolved" | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [debugLog, setDebugLog] = useState<DebugEntry[]>([]);
  const showDebugPanel = __DEV__ || process.env.EXPO_PUBLIC_DEBUG_LOGS === "true";

  const pushDebug = useCallback((action: string, detail?: string) => {
    setDebugLog((prev) => [
      { at: new Date().toISOString(), action, detail },
      ...prev,
    ].slice(0, 12));
  }, []);

  const loadContract = useCallback(async () => {
    if (!betId) {
      setLoading(false);
      setLoadError(t("missingBetId"));
      return;
    }

    setLoading(true);
    setLoadError(null);
    pushDebug("load.start", betId);

    try {
      const result = await betContractService.loadWithDiagnostics(betId);
      setContract(result.contract);
      setDiagnosis(result.diagnosis);
      pushDebug(
        result.contract ? "load.success" : "load.missing",
        result.contract
          ? `${result.contract.contract_number} (${result.durationMs}ms, ${result.attempts} attempts)`
          : `${result.diagnosis?.reason ?? "unknown"} (${result.durationMs}ms)`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : t("loadErrorBody");
      setLoadError(message);
      setContract(null);
      setDiagnosis(null);
      pushDebug("load.error", message);
    } finally {
      setLoading(false);
    }
  }, [betId, pushDebug, t]);

  useEffect(() => {
    void loadContract();
  }, [loadContract]);

  const handleDownloadPdf = async () => {
    if (!contract) return;
    setDownloading(true);
    pushDebug("pdf.start", contract.contract_number);
    try {
      const appUrl = getPublicEnv().appUrl ?? "https://anymarket.expo.app";
      const html = buildBetContractHtml({
        contract,
        eventType: contract.resolved_snapshot ? "resolved" : "placed",
        appUrl,
      });

      if (Platform.OS === "web") {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          printWindow.print();
          pushDebug("pdf.web_print");
        } else {
          showAppAlertRaw(t("downloadBlockedTitle"), t("downloadBlockedBody"));
          pushDebug("pdf.blocked", "popup-blocked");
        }
        return;
      }

      const Print = require("expo-print");
      const Sharing = require("expo-sharing");
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Save wager agreement",
          UTI: "com.adobe.pdf",
        });
      } else {
        showAppAlertRaw(t("savedTitle"), t("savedBody", { uri }));
      }
      pushDebug("pdf.native_success", uri);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("loadErrorBody");
      pushDebug("pdf.error", message);
      showAppAlertRaw(t("downloadFailedTitle"), message);
    } finally {
      setDownloading(false);
    }
  };

  const handleSendEmail = async (eventType: "placed" | "resolved") => {
    if (!contract) return;
    setSending(eventType);
    pushDebug("email.start", eventType);
    try {
      const result = await betContractService.sendEmail(contract.id, eventType, true);
      if (!result.ok) {
        throw new Error(result.error ?? "Failed to send email");
      }
      pushDebug(
        result.skipped ? "email.skipped" : "email.sent",
        result.emailId ?? result.sentAt,
      );
      showAppAlertRaw(
        result.skipped ? t("emailAlreadySentTitle") : t("emailSentTitle"),
        result.skipped ? t("emailAlreadySentBody") : t("emailSentBody"),
      );
      await loadContract();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("loadErrorBody");
      pushDebug("email.error", message);
      showAppAlertRaw(t("emailFailedTitle"), message);
    } finally {
      setSending(null);
    }
  };

  const handleShareText = async () => {
    if (!contract) return;
    const appUrl = getPublicEnv().appUrl ?? "https://anymarket.expo.app";
    await Share.share({
      message: buildBetContractPlainText({
        contract,
        eventType: contract.resolved_snapshot ? "resolved" : "placed",
        appUrl,
      }),
    });
    pushDebug("share.text");
  };

  const handleCopyDebug = async () => {
    const payload = {
      betId,
      contractId: contract?.id ?? null,
      diagnosis,
      debugLog,
    };
    const text = JSON.stringify(payload, null, 2);
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      showAppAlertRaw(t("copiedTitle"), t("copiedBody"));
      return;
    }
    await Share.share({ message: text });
  };

  if (loading) {
    return (
      <AppScreen testID="contract-root" maxWidth="narrow" style={{ gap: 16 }}>
        <AppSkeleton variant="text" width="70%" height={28} />
        <AppSkeleton variant="text" width="50%" />
        <AppSkeleton variant="card" height={120} />
        <AppSkeleton variant="card" height={160} />
      </AppScreen>
    );
  }

  if (loadError) {
    return (
      <AppScreen testID="contract-root" maxWidth="narrow" style={styles.centerPad}>
        <AppText variant="title2" style={{ textAlign: "center" }}>{t("loadError")}</AppText>
        <ErrorBanner message={loadError} onRetry={() => void loadContract()} retryLabel={t("retry")} />
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
          <AppText color="secondary">{t("goBack")}</AppText>
        </TouchableOpacity>
      </AppScreen>
    );
  }

  if (!contract) {
    return (
      <AppScreen testID="contract-root" maxWidth="narrow" style={styles.centerPad}>
        <EmptyState
          icon="document-text-outline"
          title={diagnosis?.title ?? t("emptyTitle")}
          description={diagnosis?.message ?? t("emptyBody")}
          actionLabel={diagnosis?.canRetry ? t("retry") : undefined}
          onAction={diagnosis?.canRetry ? () => void loadContract() : undefined}
        />
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12, alignSelf: "center" }}>
          <AppText color="secondary">{t("goBack")}</AppText>
        </TouchableOpacity>
        {showDebugPanel && diagnosis ? (
          <View style={[styles.debugPanel, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <AppText variant="caption" color="secondary" style={{ fontWeight: "700", letterSpacing: 0.5 }}>
              {t("debug")}
            </AppText>
            <AppText variant="caption" style={{ fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>
              {betContractService.formatDiagnosisForDebug(diagnosis)}
            </AppText>
            <TouchableOpacity onPress={() => void handleCopyDebug()}>
              <AppText color="primary" style={{ marginTop: 8 }}>{t("copyDebug")}</AppText>
            </TouchableOpacity>
          </View>
        ) : null}
      </AppScreen>
    );
  }

  const snapshot = parseBetContractSnapshot(contract.placed_snapshot);
  const resolution = parseBetContractResolution(contract.resolved_snapshot);
  const appUrl = getPublicEnv().appUrl ?? "https://anymarket.expo.app";

  return (
    <AppScreen testID="contract-root" maxWidth="narrow" scroll scrollProps={{ contentContainerStyle: styles.content }}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <AppText color="primary" style={{ fontSize: 16 }}>{t("back")}</AppText>
        </TouchableOpacity>

        <AppText variant="display" style={{ marginBottom: 4 }}>{t("title")}</AppText>
        <AppText variant="bodySm" color="secondary" style={{ marginBottom: 12 }}>
          {snapshot.contractNumber} · {contract.jurisdiction}
        </AppText>

        <View style={styles.statusRow}>
          <EmailStatus
            testID="contract-email-placed"
            label={t("placedEmail")}
            sentAt={contract.placed_email_sent_at}
            theme={theme}
            t={t}
          />
          <EmailStatus
            testID="contract-email-resolved"
            label={t("settlementEmail")}
            sentAt={contract.resolved_email_sent_at}
            theme={theme}
            pending={!resolution}
            t={t}
          />
        </View>

        <Section title={t("sectionWallet")} theme={theme}>
          <Row label={t("bettor")} value={snapshot.bettor.username} theme={theme} />
          <Row label={t("walletId")} value={snapshot.wallet.walletId} theme={theme} />
          <Row
            label={t("debit")}
            value={`${snapshot.wallet.debitAmount} ${snapshot.wallet.currency}`}
            theme={theme}
          />
        </Section>

        <Section title={t("sectionMarket")} theme={theme}>
          <AppText variant="title3" style={{ marginBottom: 4 }}>{snapshot.market.question}</AppText>
          <Row
            label={t("option")}
            value={`${snapshot.position.optionLabel} (${snapshot.position.side.toUpperCase()})`}
            theme={theme}
          />
          <Row label={t("stake")} value={`${snapshot.position.amount}`} theme={theme} />
          <Row
            label={t("placed")}
            value={new Date(snapshot.position.placedAt).toLocaleString()}
            theme={theme}
          />
        </Section>

        {snapshot.group ? (
          <Section title={t("sectionGroup")} theme={theme}>
            <Row label={t("group")} value={snapshot.group.name} theme={theme} />
            <Row label={t("admin")} value={snapshot.group.adminUsername ?? "—"} theme={theme} />
            <Row label={t("participants")} value={String(snapshot.group.memberCount)} theme={theme} />
          </Section>
        ) : null}

        <Section title={t("sectionLegal")} theme={theme}>
          {(snapshot.legal.disclaimers ?? []).map((item) => (
            <AppText key={item} variant="bodySm" color="secondary" style={{ lineHeight: 20 }}>
              • {item}
            </AppText>
          ))}
          {(snapshot.legal.acceptedPolicies ?? []).map((policy) => (
            <TouchableOpacity
              key={`${policy.kind}-${policy.version}`}
              onPress={() => Linking.openURL(`${appUrl}${policy.url ?? "/terms"}`)}
            >
              <AppText variant="bodySm" color="primary" style={{ marginTop: 4 }}>
                {policy.title} ({policy.version})
              </AppText>
            </TouchableOpacity>
          ))}
        </Section>

        {resolution ? (
          <Section title={t("sectionSettlement")} theme={theme}>
            <Row label={t("outcome")} value={resolution.outcome.toUpperCase()} theme={theme} />
            <Row label={t("winner")} value={resolution.winningOptionLabel ?? "—"} theme={theme} />
            <Row label={t("payout")} value={String(resolution.payoutAmount)} theme={theme} />
          </Section>
        ) : null}

        <View style={styles.actions}>
          <ActionButton
            label={downloading ? t("pdfPreparing") : t("downloadPdf")}
            onPress={() => void handleDownloadPdf()}
            disabled={downloading}
            theme={theme}
          />
          <ActionButton
            label={sending === "placed" ? t("sending") : t("emailAgreement")}
            onPress={() => void handleSendEmail("placed")}
            disabled={sending !== null}
            theme={theme}
          />
          {resolution ? (
            <ActionButton
              label={sending === "resolved" ? t("sending") : t("emailSettlement")}
              onPress={() => void handleSendEmail("resolved")}
              disabled={sending !== null}
              theme={theme}
            />
          ) : null}
          <ActionButton label={t("shareSummary")} onPress={() => void handleShareText()} theme={theme} secondary />
        </View>

        {showDebugPanel ? (
          <View style={[styles.debugPanel, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <AppText variant="caption" color="secondary" style={{ fontWeight: "700", letterSpacing: 0.5 }}>
              {t("debugLog")}
            </AppText>
            <AppText variant="caption" style={{ fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>
              betId: {betId}
              {"\n"}contractId: {contract.id}
            </AppText>
            {debugLog.map((entry) => (
              <AppText
                key={`${entry.at}-${entry.action}`}
                variant="caption"
                color="secondary"
                style={{ fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}
              >
                {entry.at} · {entry.action}
                {entry.detail ? ` · ${entry.detail}` : ""}
              </AppText>
            ))}
            <TouchableOpacity onPress={() => void handleCopyDebug()}>
              <AppText color="primary" style={{ marginTop: 8 }}>{t("copyDebug")}</AppText>
            </TouchableOpacity>
          </View>
        ) : null}
    </AppScreen>
  );
}

function EmailStatus({
  label,
  sentAt,
  pending,
  theme,
  testID,
  t,
}: {
  label: string;
  sentAt: string | null;
  pending?: boolean;
  theme: ReturnType<typeof useTheme>["theme"];
  testID?: string;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  let status = pending ? t("pendingResolution") : t("notSent");
  let color = theme.textSecondary;
  if (sentAt) {
    status = t("sentAt", { date: new Date(sentAt).toLocaleString() });
    color = "#059669";
  }
  return (
    <View style={styles.statusChip} testID={testID}>
      <AppText variant="caption" color="secondary" style={{ fontWeight: "700", textTransform: "uppercase" }}>
        {label}
      </AppText>
      <AppText variant="bodySm" style={{ color }}>{status}</AppText>
    </View>
  );
}

function Section({
  title,
  children,
  theme,
}: {
  title: string;
  children: React.ReactNode;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  return (
    <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <AppText variant="label" color="secondary" style={{ letterSpacing: 0.6, marginBottom: 4, textTransform: "uppercase" }}>
        {title}
      </AppText>
      {children}
    </View>
  );
}

function Row({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  return (
    <View style={styles.row}>
      <AppText variant="bodySm" color="secondary" style={{ flex: 1 }}>{label}</AppText>
      <AppText variant="bodySm" style={{ flex: 1.2, textAlign: "right", fontWeight: "600" }}>{value}</AppText>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  theme,
  secondary,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  theme: ReturnType<typeof useTheme>["theme"];
  secondary?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        secondary
          ? { backgroundColor: isDarkSurface(theme) ? "#1C1C1E" : "#F2F2F7", borderColor: theme.border }
          : { backgroundColor: Brand.primary },
        disabled ? { opacity: 0.6 } : null,
      ]}
    >
      <AppText style={{ color: secondary ? theme.text : "#fff", fontWeight: "600", textAlign: "center" }}>
        {label}
      </AppText>
    </TouchableOpacity>
  );
}

function isDarkSurface(theme: ReturnType<typeof useTheme>["theme"]) {
  return theme.background === "#000000" || theme.background === "#030712";
}

const styles = StyleSheet.create({
  centerPad: { flex: 1, justifyContent: "center", gap: 10 },
  content: { paddingBottom: 40 },
  backRow: { marginBottom: 12 },
  statusRow: { gap: 8, marginBottom: 16 },
  statusChip: { gap: 2 },
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  actions: { gap: 10, marginTop: 8 },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  debugPanel: {
    marginTop: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
});
