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
import { betContractService } from "@/services/betContract.service";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    SafeAreaView,
    ScrollView,
    Share,
    StyleSheet,
    Text,
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
      setLoadError("Missing bet id in route.");
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
      const message = error instanceof Error ? error.message : "Failed to load wager agreement.";
      setLoadError(message);
      setContract(null);
      setDiagnosis(null);
      pushDebug("load.error", message);
    } finally {
      setLoading(false);
    }
  }, [betId, pushDebug]);

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
          Alert.alert("Download blocked", "Allow pop-ups to print or save the contract as PDF.");
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
        Alert.alert("Saved", `Contract PDF saved to ${uri}`);
      }
      pushDebug("pdf.native_success", uri);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not generate PDF.";
      pushDebug("pdf.error", message);
      Alert.alert("Download failed", message);
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
      Alert.alert(
        result.skipped ? "Already sent" : "Email sent",
        result.skipped
          ? "This contract email was already delivered."
          : "Check your inbox for the wager agreement.",
      );
      await loadContract();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send email.";
      pushDebug("email.error", message);
      Alert.alert("Email failed", message);
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
      Alert.alert("Copied", "Debug info copied to clipboard.");
      return;
    }
    await Share.share({ message: text });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Loading wager agreement…
        </Text>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={[styles.centerPad, { backgroundColor: theme.background }]}>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>Could not load agreement</Text>
        <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>{loadError}</Text>
        <TouchableOpacity onPress={() => void loadContract()} style={styles.retryButton}>
          <Text style={{ color: theme.primary, fontWeight: "600" }}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: theme.textSecondary }}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!contract) {
    return (
      <SafeAreaView style={[styles.centerPad, { backgroundColor: theme.background }]}>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>
          {diagnosis?.title ?? "Wager agreement not found"}
        </Text>
        <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
          {diagnosis?.message ??
            "Live private group bets generate wallet-tied wager agreements. This bet does not have one."}
        </Text>
        {diagnosis?.canRetry ? (
          <TouchableOpacity onPress={() => void loadContract()} style={styles.retryButton}>
            <Text style={{ color: theme.primary, fontWeight: "600" }}>Retry</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: theme.textSecondary }}>Go back</Text>
        </TouchableOpacity>
        {showDebugPanel && diagnosis ? (
          <View style={[styles.debugPanel, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <Text style={[styles.debugTitle, { color: theme.textSecondary }]}>DEBUG</Text>
            <Text style={[styles.debugBody, { color: theme.text }]}>
              {betContractService.formatDiagnosisForDebug(diagnosis)}
            </Text>
            <TouchableOpacity onPress={() => void handleCopyDebug()}>
              <Text style={{ color: theme.primary, marginTop: 8 }}>Copy debug info</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </SafeAreaView>
    );
  }

  const snapshot = parseBetContractSnapshot(contract.placed_snapshot);
  const resolution = parseBetContractResolution(contract.resolved_snapshot);
  const appUrl = getPublicEnv().appUrl ?? "https://anymarket.expo.app";

  return (
    <SafeAreaView testID="contract-root" style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Text style={{ color: theme.primary, fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: theme.text }]}>Wager Agreement</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {snapshot.contractNumber} · {contract.jurisdiction}
        </Text>

        <View style={styles.statusRow}>
          <EmailStatus
            testID="contract-email-placed"
            label="Placed email"
            sentAt={contract.placed_email_sent_at}
            theme={theme}
          />
          <EmailStatus
            testID="contract-email-resolved"
            label="Settlement email"
            sentAt={contract.resolved_email_sent_at}
            theme={theme}
            pending={!resolution}
          />
        </View>

        <Section title="Wallet & Bettor" theme={theme}>
          <Row label="Bettor" value={snapshot.bettor.username} theme={theme} />
          <Row label="Wallet ID" value={snapshot.wallet.walletId} theme={theme} />
          <Row
            label="Debit"
            value={`${snapshot.wallet.debitAmount} ${snapshot.wallet.currency}`}
            theme={theme}
          />
        </Section>

        <Section title="Market Position" theme={theme}>
          <Text style={[styles.question, { color: theme.text }]}>{snapshot.market.question}</Text>
          <Row
            label="Option"
            value={`${snapshot.position.optionLabel} (${snapshot.position.side.toUpperCase()})`}
            theme={theme}
          />
          <Row label="Stake" value={`${snapshot.position.amount}`} theme={theme} />
          <Row
            label="Placed"
            value={new Date(snapshot.position.placedAt).toLocaleString()}
            theme={theme}
          />
        </Section>

        {snapshot.group ? (
          <Section title="Group Pool Context" theme={theme}>
            <Row label="Group" value={snapshot.group.name} theme={theme} />
            <Row label="Admin" value={snapshot.group.adminUsername ?? "—"} theme={theme} />
            <Row label="Participants" value={String(snapshot.group.memberCount)} theme={theme} />
          </Section>
        ) : null}

        <Section title="Legal Framework" theme={theme}>
          {(snapshot.legal.disclaimers ?? []).map((item) => (
            <Text key={item} style={[styles.body, { color: theme.textSecondary }]}>
              • {item}
            </Text>
          ))}
          {(snapshot.legal.acceptedPolicies ?? []).map((policy) => (
            <TouchableOpacity
              key={`${policy.kind}-${policy.version}`}
              onPress={() => Linking.openURL(`${appUrl}${policy.url ?? "/terms"}`)}
            >
              <Text style={[styles.link, { color: theme.primary }]}>
                {policy.title} ({policy.version})
              </Text>
            </TouchableOpacity>
          ))}
        </Section>

        {resolution ? (
          <Section title="Settlement" theme={theme}>
            <Row label="Outcome" value={resolution.outcome.toUpperCase()} theme={theme} />
            <Row label="Winner" value={resolution.winningOptionLabel ?? "—"} theme={theme} />
            <Row label="Payout" value={String(resolution.payoutAmount)} theme={theme} />
          </Section>
        ) : null}

        <View style={styles.actions}>
          <ActionButton
            label={downloading ? "Preparing PDF..." : "Download PDF"}
            onPress={() => void handleDownloadPdf()}
            disabled={downloading}
            theme={theme}
          />
          <ActionButton
            label={sending === "placed" ? "Sending..." : "Email Agreement"}
            onPress={() => void handleSendEmail("placed")}
            disabled={sending !== null}
            theme={theme}
          />
          {resolution ? (
            <ActionButton
              label={sending === "resolved" ? "Sending..." : "Email Settlement"}
              onPress={() => void handleSendEmail("resolved")}
              disabled={sending !== null}
              theme={theme}
            />
          ) : null}
          <ActionButton label="Share Summary" onPress={() => void handleShareText()} theme={theme} secondary />
        </View>

        {showDebugPanel ? (
          <View style={[styles.debugPanel, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <Text style={[styles.debugTitle, { color: theme.textSecondary }]}>DEBUG LOG</Text>
            <Text style={[styles.debugBody, { color: theme.text }]}>
              betId: {betId}
              {"\n"}contractId: {contract.id}
            </Text>
            {debugLog.map((entry) => (
              <Text key={`${entry.at}-${entry.action}`} style={[styles.debugLine, { color: theme.textSecondary }]}>
                {entry.at} · {entry.action}
                {entry.detail ? ` · ${entry.detail}` : ""}
              </Text>
            ))}
            <TouchableOpacity onPress={() => void handleCopyDebug()}>
              <Text style={{ color: theme.primary, marginTop: 8 }}>Copy debug info</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function EmailStatus({
  label,
  sentAt,
  pending,
  theme,
  testID,
}: {
  label: string;
  sentAt: string | null;
  pending?: boolean;
  theme: ReturnType<typeof useTheme>["theme"];
  testID?: string;
}) {
  let status = pending ? "Pending resolution" : "Not sent";
  let color = theme.textSecondary;
  if (sentAt) {
    status = `Sent ${new Date(sentAt).toLocaleString()}`;
    color = "#059669";
  }
  return (
    <View style={styles.statusChip} testID={testID}>
      <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.statusValue, { color }]}>{status}</Text>
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
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title.toUpperCase()}</Text>
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
      <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.text }]}>{value}</Text>
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
      <Text style={{ color: secondary ? theme.text : "#fff", fontWeight: "600", textAlign: "center" }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function isDarkSurface(theme: ReturnType<typeof useTheme>["theme"]) {
  return theme.background === "#000000" || theme.background === "#030712";
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  centerPad: { flex: 1, justifyContent: "center", padding: 24, gap: 10 },
  loadingText: { fontSize: 14 },
  emptyTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  emptyBody: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  retryButton: { marginTop: 16, paddingVertical: 8 },
  content: { padding: 20, paddingBottom: 40 },
  backRow: { marginBottom: 12 },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 12 },
  statusRow: { gap: 8, marginBottom: 16 },
  statusChip: { gap: 2 },
  statusLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  statusValue: { fontSize: 13 },
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, marginBottom: 4 },
  question: { fontSize: 17, fontWeight: "600", marginBottom: 4 },
  body: { fontSize: 14, lineHeight: 20 },
  link: { fontSize: 14, marginTop: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rowLabel: { fontSize: 14, flex: 1 },
  rowValue: { fontSize: 14, fontWeight: "600", flex: 1.2, textAlign: "right" },
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
  debugTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  debugBody: { fontSize: 12, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  debugLine: { fontSize: 11, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
});
