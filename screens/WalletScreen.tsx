import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    KeyboardAvoidingView,
    Linking,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { GlobalHeader } from "../components/GlobalHeader";
import { RulesModal } from "../components/profile/RulesModal";
import { AppButton, AppInput, AppSkeleton, AppText, EmptyState } from "@/components/ui";
import { WalletActionRail, type WalletActionKey } from "../components/wallet/WalletActionRail";
import {
    WalletHistoryFilters,
    type WalletHistoryFilter,
} from "../components/wallet/WalletHistoryFilters";
import { WalletOnboardingCard } from "../components/wallet/WalletOnboardingCard";
import { WalletOverviewCard } from "../components/wallet/WalletOverviewCard";
import { useAuthContext } from "../contexts/AuthContext";
import { useAppLocale } from "../contexts/LocaleContext";
import { useTheme } from "../contexts/ThemeContext";
import { useWalletContext } from "../contexts/WalletContext";
import { formatCurrency } from "../lib/parimutuel";
import { isStripeNativeAvailable, useStripe } from "../lib/stripe-bridge";
import { showAppAlertRaw } from "@/lib/ui/feedback";
import { walletService } from "../services/wallet.service";

const PREDEFINED_AMOUNTS = [10, 20, 50, 100];
const MIN_DEPOSIT = 10;
const MIN_WITHDRAWAL = 15;

type OnboardingState = "ready" | "needs_identity" | "pending_review";

function sanitizeAmount(text: string) {
  let cleaned = text.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    cleaned = `${parts[0]}.${parts.slice(1).join("")}`;
  }
  if (parts.length === 2 && parts[1].length > 2) {
    cleaned = `${parts[0]}.${parts[1].slice(0, 2)}`;
  }
  return cleaned;
}

function mapOnboardingLabel(state: OnboardingState, t: (key: string) => string) {
  if (state === "ready") return t("payoutsEnabled");
  if (state === "pending_review") return t("verificationReview");
  return t("setupRequired");
}

function mapTxCategory(type: string): WalletHistoryFilter {
  if (type === "transfer_sent" || type === "transfer_received") return "transfers";
  if (type === "deposit") return "deposits";
  if (type === "withdrawal") return "withdrawals";
  if (type.startsWith("bet_")) return "bets";
  return "all";
}

function txTitle(type: string, t: (key: string) => string): string {
  switch (type) {
    case "deposit":
      return t("depositLabel");
    case "withdrawal":
      return t("withdrawLabel");
    case "transfer_sent":
      return t("sent");
    case "transfer_received":
      return t("received");
    case "bet_placed":
      return t("betPlaced");
    case "bet_won":
      return t("betWon");
    case "bet_lost":
      return t("betLost");
    default:
      return t("history");
  }
}

export function WalletScreen() {
  const router = useRouter();
  const stripe = useStripe();
  const { user } = useAuthContext();
  const { theme, isDark } = useTheme();
  const { locale } = useAppLocale();
  const { t } = useTranslation("wallet");
  const intlLocale = locale === "es" ? "es-EC" : "en-US";
  const {
    balance,
    isPlayMode,
    toggleMode,
    withdrawToStripe,
    lookupRecipient,
    sendFunds,
    refresh,
    liveWalletReady,
    requestLiveMode,
  } = useWalletContext();

  const [walletAction, setWalletAction] = useState<WalletActionKey>("deposit");
  const [amount, setAmount] = useState("");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<WalletHistoryFilter>("all");
  const [txLimit, setTxLimit] = useState(10);
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipient, setRecipient] = useState<{
    id: string;
    username: string;
    email: string | null;
  } | null>(null);
  const [sendNote, setSendNote] = useState("");
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [isRulesVisible, setIsRulesVisible] = useState(false);
  const [onboardingState, setOnboardingState] = useState<OnboardingState>("needs_identity");
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  const filteredTransactions = useMemo(() => {
    const rows = historyFilter === "all"
      ? transactions
      : transactions.filter((tx) => mapTxCategory(tx.type) === historyFilter);
    return rows.slice(0, txLimit);
  }, [historyFilter, transactions, txLimit]);

  useEffect(() => {
    loadTransactions();
    loadOnboarding();

    if (Platform.OS === "web") {
      const params = new URLSearchParams(window.location.search);
      const success = params.get("success");
      const canceled = params.get("canceled");
      const onboarding = params.get("onboarding");

      if (success === "true") {
        setBannerMessage("Deposit complete. Balance updates in a few seconds.");
      } else if (canceled === "true") {
        setBannerMessage("Deposit canceled.");
      } else if (onboarding === "complete" || onboarding === "return") {
        setBannerMessage("Onboarding complete. Withdrawals are now enabled.");
      } else if (onboarding === "refresh") {
        setBannerMessage("Onboarding incomplete. Continue setup to enable payouts.");
      }

      if (success || canceled || onboarding) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, [isPlayMode, user?.id]);

  const loadTransactions = async () => {
    if (!user?.id) return;
    setTransactionsLoading(true);
    const rows = await walletService.getTransactions(user.id, isPlayMode);
    setTransactions(rows);
    setTransactionsLoading(false);
  };

  const loadOnboarding = async () => {
    if (!user?.id || isPlayMode) return;
    const status = await walletService.getOnboardingStatus(user.id);
    if (status) {
      setOnboardingState(status.state);
    }
  };

  const ensureLiveWalletAccess = (): boolean => {
    if (isPlayMode || liveWalletReady) return true;
    if (Platform.OS === "web") {
      router.push("/wallet/verify" as any);
      return false;
    }
    Alert.alert(
      "Identity verification required",
      "Verify your identity before using the live wallet.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Verify", onPress: () => router.push("/wallet/verify" as any) },
      ],
    );
    return false;
  };

  const handleTopUp = async () => {
    if (!ensureLiveWalletAccess()) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value < MIN_DEPOSIT) {
      showAppAlertRaw("Minimum deposit", `Enter at least $${MIN_DEPOSIT}.00`);
      return;
    }

    if (!user?.id) {
      showAppAlertRaw("Sign in required", "Please sign in to add funds.");
      return;
    }

    if (Platform.OS === "web") {
      setLoading(true);
      const result = await walletService.createCheckoutSession(
        Math.round(value * 100),
        user.id,
      );
      setLoading(false);
      if (result?.url) {
        window.location.href = result.url;
      } else {
        showAppAlertRaw("Payment unavailable", "Unable to start checkout right now.");
      }
      return;
    }

    if (!isStripeNativeAvailable) {
      showAppAlertRaw(
        "Stripe unavailable",
        "Use a development build to test native payments.",
      );
      return;
    }

    setLoading(true);
    const intent = await walletService.createPaymentIntent(
      Math.round(value * 100),
      user.email || undefined,
      user.id,
    );
    if (!intent) {
      setLoading(false);
      showAppAlertRaw("Payment unavailable", "Unable to initialize payment.");
      return;
    }

    const { error: initError } = await stripe.initPaymentSheet({
      merchantDisplayName: "Qbet",
      customerId: intent.customer,
      customerEphemeralKeySecret: intent.ephemeralKey,
      paymentIntentClientSecret: intent.paymentIntent,
      returnURL: "qbet://wallet",
      allowsDelayedPaymentMethods: true,
    });

    if (initError) {
      setLoading(false);
      showAppAlertRaw("Payment error", initError.message);
      return;
    }

    const { error: presentError } = await stripe.presentPaymentSheet();
    setLoading(false);
    if (presentError) {
      showAppAlertRaw("Payment error", presentError.message);
      return;
    }

    setAmount("");
    setBannerMessage("Deposit successful.");
    await loadTransactions();
    await refresh();
  };

  const handleContinueOnboarding = async () => {
    if (!user?.id || !user?.email) return;
    setOnboardingLoading(true);
    try {
      const latest = await walletService.getOnboardingStatus(user.id);
      if (latest?.state === "ready") {
        setOnboardingState("ready");
        setBannerMessage("Wallet already ready for payouts.");
        return;
      }

      const link = await walletService.startOnboarding(user.id, user.email);
      if (!link?.url) {
        showAppAlertRaw("Setup unavailable", "Unable to open Stripe onboarding.");
        return;
      }

      if (Platform.OS === "web") {
        window.location.href = link.url;
      } else {
        await Linking.openURL(link.url);
      }
    } finally {
      setOnboardingLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!ensureLiveWalletAccess()) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value < MIN_WITHDRAWAL) {
      showAppAlertRaw("Minimum withdrawal", `Enter at least $${MIN_WITHDRAWAL}.00`);
      return;
    }
    if (value > balance) {
      showAppAlertRaw("Insufficient balance", "Your wallet balance is too low.");
      return;
    }
    if (onboardingState !== "ready") {
      showAppAlertRaw("Complete setup", "Finish Stripe onboarding to withdraw.");
      return;
    }

    setLoading(true);
    const result = await withdrawToStripe(Math.round(value * 100));
    setLoading(false);

    if (!result.success) {
      showAppAlertRaw("Withdrawal failed", result.error || "Please try again.");
      return;
    }

    if (result.needsOnboarding) {
      if (Platform.OS === "web") {
        window.location.href = result.needsOnboarding;
      } else {
        await Linking.openURL(result.needsOnboarding);
      }
      return;
    }

    setAmount("");
    setBannerMessage("Withdrawal submitted. Funds usually arrive in 2-3 business days.");
    await loadTransactions();
    await refresh();
  };

  const handleRecipientLookup = async () => {
    if (!recipientQuery.trim()) return;
    setLoading(true);
    const match = await lookupRecipient(recipientQuery);
    setLoading(false);
    if (!match) {
      setRecipient(null);
      showAppAlertRaw("User not found", "Try a username or email.");
      return;
    }
    setRecipient(match);
  };

  const handleSend = async () => {
    if (!ensureLiveWalletAccess()) return;
    const value = Number(amount);
    if (!recipient) {
      showAppAlertRaw("Recipient required", "Find a user first.");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      showAppAlertRaw("Invalid amount", "Enter a valid send amount.");
      return;
    }
    if (value > balance) {
      showAppAlertRaw("Insufficient balance", "Your wallet balance is too low.");
      return;
    }
    if (onboardingState !== "ready") {
      showAppAlertRaw("Complete setup", "Finish Stripe onboarding before sending.");
      return;
    }

    const confirmation = Platform.OS === "web"
      ? window.confirm(`Send ${formatCurrency(value)} to @${recipient.username}?`)
      : true;
    if (!confirmation) return;

    setLoading(true);
    const result = await sendFunds({
      recipientId: recipient.id,
      amount: value,
      note: sendNote.trim() || undefined,
      clientReference: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    });
    setLoading(false);

    if (!result.success) {
      showAppAlertRaw("Send failed", result.error);
      return;
    }

    setAmount("");
    setSendNote("");
    setRecipientQuery("");
    setRecipient(null);
    setBannerMessage(`Sent ${formatCurrency(value)} to @${recipient.username}.`);
    await loadTransactions();
    await refresh();
  };

  const copyReceiveHandle = async () => {
    const handle = user?.username
      ? `@${user.username}`
      : user?.email || "";
    if (!handle) return;

    try {
      if (Platform.OS === "web" && navigator?.clipboard) {
        await navigator.clipboard.writeText(handle);
      }
      setBannerMessage("Receive handle copied.");
    } catch {
      showAppAlertRaw("Copy failed", "Please copy it manually.");
    }
  };

  const renderActionPanel = () => {
    if (walletAction === "deposit") {
      return (
        <View>
          <View style={[styles.walletGuideCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <AppText variant="title3">{t("addLiveFunds")}</AppText>
            <AppText variant="bodySm" color="secondary" style={styles.walletGuideText}>
              Deposits go to your live wallet. Practice credits stay separate, and the minimum deposit is ${MIN_DEPOSIT}.
            </AppText>
          </View>
          <AppText variant="label" color="secondary" style={styles.sectionTitle}>Quick amounts</AppText>
          <View style={styles.quickRow}>
            {PREDEFINED_AMOUNTS.map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.quickChip,
                  { backgroundColor: isDark ? "#1C1C1E" : "#E5E5EA" },
                  amount === String(value) && { backgroundColor: theme.primary },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setAmount(String(value));
                }}
              >
                <AppText
                  variant="label"
                  style={{ color: amount === String(value) ? theme.onPrimary : theme.text }}
                >
                  ${value}
                </AppText>
              </TouchableOpacity>
            ))}
          </View>
          <AppText variant="label" color="secondary" style={styles.sectionTitle}>Custom amount</AppText>
          <AppInput
            testID="topup-amount"
            value={amount}
            onChangeText={(text) => setAmount(sanitizeAmount(text))}
            placeholder={`Minimum $${MIN_DEPOSIT}`}
            keyboardType="decimal-pad"
          />
          <AppButton
            testID="topup-submit"
            title="Add Funds"
            loading={loading}
            onPress={handleTopUp}
            style={styles.primaryButton}
          />
        </View>
      );
    }

    if (walletAction === "send") {
      return (
        <View>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Recipient</Text>
          <View style={styles.lookupRow}>
            <TextInput
              value={recipientQuery}
              onChangeText={setRecipientQuery}
              placeholder="@username or email"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                styles.lookupInput,
                { color: theme.text, backgroundColor: isDark ? theme.background : "#F2F2F7" },
              ]}
            />
            <TouchableOpacity
              style={[styles.lookupButton, { backgroundColor: theme.primary }]}
              onPress={handleRecipientLookup}
            >
              <Text style={styles.lookupButtonText}>Find</Text>
            </TouchableOpacity>
          </View>

          {recipient ? (
            <View style={[styles.infoBox, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <Text style={[styles.infoTitle, { color: theme.text }]}>@{recipient.username}</Text>
              <Text style={[styles.infoSub, { color: theme.textSecondary }]}>{recipient.email || "Qbet user"}</Text>
            </View>
          ) : null}

          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Amount</Text>
          <TextInput
            value={amount}
            onChangeText={(text) => setAmount(sanitizeAmount(text))}
            placeholder="0.00"
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
            style={[
              styles.input,
              { color: theme.text, backgroundColor: isDark ? theme.background : "#F2F2F7" },
            ]}
          />
          <TextInput
            value={sendNote}
            onChangeText={setSendNote}
            placeholder="Add note (optional)"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              { color: theme.text, backgroundColor: isDark ? theme.background : "#F2F2F7", marginTop: 10 },
            ]}
          />
          <AppButton
            title="Send Funds"
            loading={loading}
            onPress={handleSend}
            style={styles.primaryButton}
          />
        </View>
      );
    }

    if (walletAction === "receive") {
      return (
        <View>
          <View style={[styles.infoBox, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <Text style={[styles.infoTitle, { color: theme.text }]}>Your receive handle</Text>
            <Text style={[styles.receiveHandle, { color: theme.primary }]}>
              {user?.username ? `@${user.username}` : user?.email || "Unavailable"}
            </Text>
            <Text style={[styles.infoSub, { color: theme.textSecondary }]}>
              Share this with another user so they can send funds instantly.
            </Text>
          </View>
          <AppButton
            title="Copy Receive Handle"
            onPress={copyReceiveHandle}
            style={styles.primaryButton}
          />
        </View>
      );
    }

    return (
      <View>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Withdraw amount</Text>
        <TextInput
          value={amount}
          onChangeText={(text) => setAmount(sanitizeAmount(text))}
          placeholder={`Min $${MIN_WITHDRAWAL}`}
          placeholderTextColor={theme.textSecondary}
          keyboardType="decimal-pad"
          style={[
            styles.input,
            { color: theme.text, backgroundColor: isDark ? theme.background : "#F2F2F7" },
          ]}
        />
        {amount ? (
          <TouchableOpacity
            style={[styles.feeRow, { borderColor: theme.border, backgroundColor: theme.surface }]}
            onPress={() => setIsRulesVisible(true)}
          >
            <Text style={{ color: theme.textSecondary }}>Fees and settlement timeline</Text>
            <Text style={{ color: theme.primary }}>View</Text>
          </TouchableOpacity>
        ) : null}
        <AppButton
          title="Confirm Withdrawal"
          loading={loading}
          onPress={handleWithdraw}
          style={styles.primaryButton}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <GlobalHeader
        ignoreTopInset
        left={(
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButtonLeft}>
            <Text style={[styles.backButtonText, { color: theme.primary }]}>←</Text>
          </TouchableOpacity>
        )}
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            Platform.OS === "web" && { maxWidth: 640, alignSelf: "center", width: "100%" } as any,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <WalletOverviewCard
            balanceLabel={isPlayMode ? "Play balance" : "Live balance"}
            balanceDisplay={formatCurrency(balance, "USD", intlLocale)}
            subtitle={isPlayMode ? "Trial credits for practice only." : "Real-money wallet"}
            onboardingLabel={!isPlayMode ? mapOnboardingLabel(onboardingState, t) : undefined}
            theme={theme}
          />

          {bannerMessage ? (
            <View style={[styles.banner, { backgroundColor: `${theme.primary}14` }]}>
              <Text style={[styles.bannerText, { color: theme.primary }]}>{bannerMessage}</Text>
            </View>
          ) : null}

          {isPlayMode ? (
            <>
              <View style={[styles.walletGuideCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.walletGuideTitle, { color: theme.text }]}>Practice wallet</Text>
                <Text style={[styles.walletGuideText, { color: theme.textSecondary }]}>
                  Practice credits help you learn the app. Switch to live only when you want to deposit or withdraw real money.
                </Text>
              </View>
              <AppButton title="Switch to Live Wallet" onPress={() => void requestLiveMode()} style={styles.primaryButton} />
            </>
          ) : !liveWalletReady ? (
            <>
              <View style={[styles.walletGuideCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.walletGuideTitle, { color: theme.text }]}>Verify to use live wallet</Text>
                <Text style={[styles.walletGuideText, { color: theme.textSecondary }]}>
                  Complete Stripe Identity verification before depositing, withdrawing, or placing live bets.
                </Text>
              </View>
              <AppButton
                title="Verify identity"
                onPress={() => router.push("/wallet/verify" as any)}
                style={styles.primaryButton}
              />
              <AppButton
                title="Back to practice mode"
                variant="ghost"
                onPress={toggleMode}
                style={styles.secondaryLinkButton}
              />
            </>
          ) : (
            <>
              <View style={[styles.walletModeCard, { backgroundColor: `${theme.primary}14`, borderColor: `${theme.primary}33` }]}>
                <Text style={[styles.walletModeText, { color: theme.primary }]}>
                  Live wallet uses real money. Add funds first, then return to a market to place live bets.
                </Text>
              </View>
              <WalletOnboardingCard
                state={onboardingState}
                loading={onboardingLoading}
                onContinue={handleContinueOnboarding}
                theme={theme}
              />
              <WalletActionRail active={walletAction} onSelect={setWalletAction} theme={theme} />
              {renderActionPanel()}
            </>
          )}

          <View style={styles.historyHeader}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Recent Activity</Text>
            <WalletHistoryFilters
              value={historyFilter}
              onChange={(next) => {
                setHistoryFilter(next);
                setTxLimit(10);
              }}
              theme={theme}
            />
          </View>

          <View style={[styles.historyList, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {transactionsLoading ? (
              <AppSkeleton variant="text" style={{ marginVertical: 20, alignSelf: "center", width: "60%" }} />
            ) : filteredTransactions.length === 0 ? (
              <EmptyState icon="receipt-outline" title="No transactions yet." />
            ) : (
              filteredTransactions.map((tx, index) => {
                const isPositive = Number(tx.amount) > 0;
                const direction = tx.type === "transfer_sent"
                  ? `To @${tx.metadata?.counterparty_username || "user"}`
                  : tx.type === "transfer_received"
                    ? `From @${tx.metadata?.counterparty_username || "user"}`
                    : null;
                const date = new Date(tx.created_at).toLocaleString();
                return (
                  <View
                    key={tx.id}
                    style={[
                      styles.txRow,
                      { borderBottomColor: theme.border },
                      index === filteredTransactions.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={[styles.txTitle, { color: theme.text }]}>{txTitle(tx.type, t)}</Text>
                      <Text style={[styles.txSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                        {direction ? `${direction} • ${date}` : date}
                      </Text>
                    </View>
                    <View style={styles.txRight}>
                      <Text style={[styles.txAmount, { color: isPositive ? theme.success : theme.text }]}>
                        {isPositive ? "+" : ""}
                        {formatCurrency(Number(tx.amount || 0), "USD", intlLocale)}
                      </Text>
                      <Text style={[styles.txStatus, { color: theme.textSecondary }]}>
                        {(tx.status || "completed").toUpperCase()}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
            {transactions.length > txLimit ? (
              <TouchableOpacity
                style={[styles.moreButton, { borderTopColor: theme.border }]}
                onPress={() => setTxLimit((prev) => prev + 10)}
              >
                <Text style={[styles.moreButtonText, { color: theme.primary }]}>
                  See More ({Math.min(txLimit, transactions.length)} of {transactions.length})
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <RulesModal
        visible={isRulesVisible}
        onClose={() => setIsRulesVisible(false)}
        initialPage={3}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerButtonLeft: {
    padding: 8,
    marginLeft: -8,
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: "300",
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  banner: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  walletGuideCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  walletGuideTitle: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 6,
  },
  walletGuideText: {
    fontSize: 14,
    lineHeight: 20,
  },
  secondaryLinkButton: {
    marginTop: 8,
    alignItems: "center",
    paddingVertical: 10,
  },
  secondaryLinkText: {
    fontSize: 14,
    fontWeight: "500",
  },
  walletModeCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  walletModeText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  quickChip: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 56,
    alignItems: "center",
  },
  quickChipText: {
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    height: 48,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 10,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  lookupRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  lookupInput: { flex: 1, marginBottom: 0 },
  lookupButton: {
    borderRadius: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  lookupButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  infoBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  infoSub: {
    marginTop: 4,
    fontSize: 13,
  },
  receiveHandle: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: "600",
  },
  feeRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyHeader: {
    marginTop: 24,
  },
  historyList: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: "hidden",
  },
  emptyHistory: {
    textAlign: "center",
    paddingVertical: 22,
    fontSize: 14,
  },
  txRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  txTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  txSubtitle: {
    marginTop: 2,
    fontSize: 12,
  },
  txRight: {
    alignItems: "flex-end",
  },
  txAmount: {
    fontSize: 15,
    fontWeight: "600",
  },
  txStatus: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
    letterSpacing: 0.3,
  },
  moreButton: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    alignItems: "center",
  },
  moreButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
