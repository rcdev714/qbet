import {
  AppButton,
  AppInput,
  AppScreen,
  AppText,
  FieldGroup,
} from "@/components/ui";
import { BackButton } from "@/components/ui/BackButton";
import { showAppAlertRaw } from "@/lib/ui/feedback";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { GlobalHeader } from "@/components/GlobalHeader";
import { RulesModal } from "@/components/profile/RulesModal";
import { WalletActionRail, type WalletActionKey } from "@/components/wallet/WalletActionRail";
import { WalletDesktopLayout } from "@/components/wallet/WalletDesktopLayout";
import {
  WalletHistoryFilters,
  type WalletHistoryFilter,
} from "@/components/wallet/WalletHistoryFilters";
import {
  WalletPayoutSetupPanel,
} from "@/components/wallet/WalletPayoutSetupPanel";
import { WalletPayoutProfileForm } from "@/components/wallet/WalletPayoutProfileForm";
import { WalletOverviewCard } from "@/components/wallet/WalletOverviewCard";
import { WalletIncomingPayouts } from "@/components/wallet/WalletIncomingPayouts";
import { WalletTransactionList } from "@/components/wallet/WalletTransactionList";
import { formatIncomingReleaseDate } from "@/lib/settlement/payout-hold-constants";
import { useAuthContext } from "@/contexts/AuthContext";
import { useAppLocale } from "@/contexts/LocaleContext";
import { useIsDesktopWebNav } from "@/contexts/NavigationLayoutContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useWalletContext } from "@/contexts/WalletContext";
import {
  buildPayoutSteps,
  mapOnboardingLabelKey,
  shouldShowPayoutSidePanel,
  shouldUseDesktopWalletLayout,
} from "@/lib/wallet-payout.logic";
import { formatCurrency } from "@/lib/parimutuel";
import { isStripeNativeAvailable, useStripe } from "@/lib/stripe-bridge";
import { walletService, type PayoutDraft, type PayoutSetupState } from "@/services/wallet.service";

const PREDEFINED_AMOUNTS = [10, 20, 50, 100];
const MIN_DEPOSIT = 10;
const MIN_WITHDRAWAL = 15;

type OnboardingState = PayoutSetupState;

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
  return t(mapOnboardingLabelKey(state));
}

function mapTxCategory(type: string): WalletHistoryFilter {
  if (type === "transfer_sent" || type === "transfer_received") return "transfers";
  if (type === "deposit") return "deposits";
  if (type === "withdrawal") return "withdrawals";
  if (type.startsWith("bet_")) return "bets";
  return "all";
}

export function WalletScreen({
  initialAction = "deposit",
  hideBackButton = false,
}: {
  initialAction?: WalletActionKey;
  hideBackButton?: boolean;
} = {}) {
  const router = useRouter();
  const stripe = useStripe();
  const { user } = useAuthContext();
  const { theme } = useTheme();
  const isDesktopWebNav = useIsDesktopWebNav();
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
    pendingIncoming,
    pendingIncomingItems,
    loadPendingIncoming,
  } = useWalletContext();

  const [walletAction, setWalletAction] = useState<WalletActionKey>(initialAction);
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
  const [onboardingState, setOnboardingState] = useState<OnboardingState>("needs_profile");
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [payoutDraft, setPayoutDraft] = useState<PayoutDraft | null>(null);
  const [walletCountry, setWalletCountry] = useState("EC");
  const [bankLinked, setBankLinked] = useState(false);
  const [profileSubmitted, setProfileSubmitted] = useState(false);

  const useDesktopWalletLayout = shouldUseDesktopWalletLayout(
    Platform.OS,
    isDesktopWebNav,
  );

  const filteredTransactions = useMemo(() => {
    const rows =
      historyFilter === "all"
        ? transactions
        : transactions.filter((tx) => mapTxCategory(tx.type) === historyFilter);
    return rows.slice(0, txLimit);
  }, [historyFilter, transactions, txLimit]);

  useEffect(() => {
    loadTransactions();
    loadOnboarding();
    if (!isPlayMode) {
      void loadPendingIncoming();
    }

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
    const wallet = await walletService.getWallet(user.id);
    if (wallet?.country) {
      setWalletCountry(wallet.country);
    }
    const status = await walletService.getPayoutSetupStatus(user.id);
    if (status) {
      setOnboardingState(status.state);
      setPayoutDraft(status.payoutDraft);
      setProfileSubmitted(status.hasProfileDraft || status.connect.detailsSubmitted);
      setBankLinked(status.globalPayouts.hasPayoutMethod);
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

  const handleStripeRedirect = async (url: string) => {
    if (Platform.OS === "web") {
      window.location.href = url;
    } else {
      await Linking.openURL(url);
    }
  };

  const handlePayoutFormSuccess = async () => {
    setBannerMessage(t("payoutSetupComplete"));
    await loadOnboarding();
  };

  const payoutSteps = buildPayoutSteps({
    liveWalletReady,
    onboardingState,
    profileSubmitted,
    bankLinked,
  });

  const showPayoutSidePanel = shouldShowPayoutSidePanel({
    liveWalletReady,
    isPlayMode,
    onboardingState,
  });

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

      await handleStripeRedirect(link.url);
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

    const confirmation =
      Platform.OS === "web"
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
    const handle = user?.username ? `@${user.username}` : user?.email || "";
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

  const renderQuickAmounts = () => (
    <View style={styles.quickRow}>
      {PREDEFINED_AMOUNTS.map((value) => {
        const selected = amount === String(value);
        return (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={`$${value}`}
            onPress={() => {
              Haptics.selectionAsync();
              setAmount(String(value));
            }}
            style={[
              styles.quickChip,
              {
                backgroundColor: selected ? theme.primary : theme.surface,
                borderColor: selected ? theme.primary : theme.border,
                borderRadius: theme.radius.pill,
              },
            ]}
          >
            <AppText variant="label" color={selected ? "onPrimary" : "default"}>
              ${value}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );

  const renderGuideCard = (title: string, body: string) => (
    <View
      style={[
        styles.guideCard,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderRadius: theme.radius.lg,
        },
      ]}
    >
      <AppText variant="title3">{title}</AppText>
      <AppText variant="bodySm" color="secondary">
        {body}
      </AppText>
    </View>
  );

  const renderActionPanel = () => {
    if (walletAction === "deposit") {
      return (
        <View>
          {renderGuideCard(
            t("addLiveFunds"),
            `Deposits go to your live wallet. Practice credits stay separate, and the minimum deposit is $${MIN_DEPOSIT}.`,
          )}
          <AppText variant="caption" color="secondary" style={styles.sectionTitle}>
            Quick amounts
          </AppText>
          {renderQuickAmounts()}
          <FieldGroup>
            <AppInput
              label="Custom amount"
              testID="topup-amount"
              value={amount}
              onChangeText={(text) => setAmount(sanitizeAmount(text))}
              placeholder={`Minimum $${MIN_DEPOSIT}`}
              keyboardType="decimal-pad"
            />
          </FieldGroup>
          <AppButton
            testID="topup-submit"
            title="Add Funds"
            size="sm"
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
          <FieldGroup>
            <View style={styles.lookupRow}>
              <View style={styles.lookupInputWrap}>
                <AppInput
                  label="Recipient"
                  value={recipientQuery}
                  onChangeText={setRecipientQuery}
                  placeholder="@username or email"
                />
              </View>
              <AppButton
                title="Find"
                size="sm"
                loading={loading}
                onPress={handleRecipientLookup}
              />
            </View>

            {recipient ? (
              <View
                style={[
                  styles.infoBox,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.surface,
                    borderRadius: theme.radius.md,
                  },
                ]}
              >
                <AppText variant="body">@{recipient.username}</AppText>
                <AppText variant="bodySm" color="secondary">
                  {recipient.email || "Qbet user"}
                </AppText>
              </View>
            ) : null}

            <AppInput
              label="Amount"
              value={amount}
              onChangeText={(text) => setAmount(sanitizeAmount(text))}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            <AppInput
              label="Note (optional)"
              value={sendNote}
              onChangeText={setSendNote}
              placeholder="Add note"
            />
          </FieldGroup>
          <AppButton
            title="Send Funds"
            size="sm"
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
          <View
            style={[
              styles.infoBox,
              {
                borderColor: theme.border,
                backgroundColor: theme.surface,
                borderRadius: theme.radius.md,
              },
            ]}
          >
            <AppText variant="body">Your receive handle</AppText>
            <AppText variant="title2" color="primary" style={styles.receiveHandle}>
              {user?.username ? `@${user.username}` : user?.email || "Unavailable"}
            </AppText>
            <AppText variant="bodySm" color="secondary">
              Share this with another user so they can send funds instantly.
            </AppText>
          </View>
          <AppButton
            title="Copy Receive Handle"
            size="sm"
            onPress={copyReceiveHandle}
            style={styles.primaryButton}
          />
        </View>
      );
    }

    return (
      <View>
        <FieldGroup>
          <AppInput
            label="Withdraw amount"
            value={amount}
            onChangeText={(text) => setAmount(sanitizeAmount(text))}
            placeholder={`Min $${MIN_WITHDRAWAL}`}
            keyboardType="decimal-pad"
          />
        </FieldGroup>
        {amount ? (
          <AppButton
            title="Fees and settlement timeline"
            variant="secondary"
            size="sm"
            onPress={() => setIsRulesVisible(true)}
            style={styles.feeButton}
          />
        ) : null}
        <AppButton
          title="Confirm Withdrawal"
          size="sm"
          loading={loading}
          onPress={handleWithdraw}
          style={styles.primaryButton}
        />
      </View>
    );
  };

  const payoutSideContent =
    showPayoutSidePanel && user?.id && user?.email ? (
      <>
        <WalletPayoutSetupPanel
          steps={payoutSteps}
          loading={onboardingLoading}
          showStripeFallback
          onContinueStripe={handleContinueOnboarding}
        />
        <WalletPayoutProfileForm
          userId={user.id}
          email={user.email}
          country={walletCountry}
          initialDraft={payoutDraft}
          defaultName={user.username ?? undefined}
          onSuccess={handlePayoutFormSuccess}
          onNeedsStripeRedirect={handleStripeRedirect}
        />
      </>
    ) : null;

  const renderLiveWalletBody = () => (
    <>
      <View
        style={[
          styles.modeCard,
          {
            backgroundColor: theme.primarySoft,
            borderColor: `${theme.primary}33`,
            borderRadius: theme.radius.md,
          },
        ]}
      >
        <AppText variant="label" color="primary">
          Live wallet uses real money. Add funds first, then return to a market to place live bets.
        </AppText>
      </View>
      <WalletDesktopLayout
        enabled={useDesktopWalletLayout}
        main={
          <>
            <WalletActionRail active={walletAction} onSelect={setWalletAction} />
            {renderActionPanel()}
          </>
        }
        side={payoutSideContent}
      />
    </>
  );

  const showBackButton = !(hideBackButton || (Platform.OS === "web" && isDesktopWebNav));

  return (
    <AppScreen
      maxWidth={useDesktopWalletLayout ? "wide" : "narrow"}
      scroll
      padBottomForTabBar={hideBackButton}
    >
      <GlobalHeader
        showToggle={!isDesktopWebNav}
        left={showBackButton ? <BackButton /> : undefined}
      />
      <WalletOverviewCard
        balanceLabel={isPlayMode ? t("playBalanceLabel") : t("availableBalance")}
        balanceDisplay={formatCurrency(balance, "USD", intlLocale)}
        subtitle={isPlayMode ? "Trial credits for practice only." : "Spendable live wallet balance"}
        incomingTotal={!isPlayMode ? pendingIncoming : 0}
        incomingDisplay={
          !isPlayMode && pendingIncoming > 0
            ? `+${formatCurrency(pendingIncoming, "USD", intlLocale)}`
            : undefined
        }
        incomingSubtitle={
          !isPlayMode && pendingIncomingItems.length > 0
            ? t("incomingAvailableAround", {
                date: formatIncomingReleaseDate(
                  pendingIncomingItems.reduce((earliest, item) =>
                    new Date(item.releasesAt) < new Date(earliest.releasesAt) ? item : earliest,
                  pendingIncomingItems[0]).releasesAt,
                  intlLocale,
                ),
              })
            : t("incoming")
        }
        onboardingLabel={!isPlayMode ? mapOnboardingLabel(onboardingState, t) : undefined}
      />

      {!isPlayMode && pendingIncomingItems.length > 0 ? (
        <WalletIncomingPayouts
          items={pendingIncomingItems}
          intlLocale={intlLocale}
          incomingLabel={t("incoming")}
          availableAroundLabel={(date) => t("incomingAvailableAround", { date })}
        />
      ) : null}

      {bannerMessage ? (
        <View
          style={[
            styles.banner,
            {
              backgroundColor: theme.primarySoft,
              borderRadius: theme.radius.md,
            },
          ]}
        >
          <AppText variant="label" color="primary">
            {bannerMessage}
          </AppText>
        </View>
      ) : null}

      {isPlayMode ? (
        <>
          {renderGuideCard(
            "Practice wallet",
            "Practice credits help you learn the app. Switch to live only when you want to deposit or withdraw real money.",
          )}
          <AppButton
            title="Switch to Live Wallet"
            size="sm"
            onPress={() => void requestLiveMode()}
            style={styles.primaryButton}
          />
        </>
      ) : !liveWalletReady ? (
        <>
          {renderGuideCard(
            "Verify to use live wallet",
            "Complete Stripe Identity verification before depositing, withdrawing, or placing live bets.",
          )}
          <AppButton
            title="Verify identity"
            size="sm"
            onPress={() => router.push("/wallet/verify" as any)}
            style={styles.primaryButton}
          />
          <AppButton
            title="Back to practice mode"
            variant="ghost"
            size="sm"
            onPress={toggleMode}
            style={styles.secondaryLinkButton}
          />
        </>
      ) : (
        renderLiveWalletBody()
      )}

      <View style={styles.historyHeader}>
        <AppText variant="caption" color="secondary" style={styles.sectionTitle}>
          Recent activity
        </AppText>
      </View>

      <WalletHistoryFilters
        value={historyFilter}
        onChange={(next) => {
          setHistoryFilter(next);
          setTxLimit(10);
        }}
      />

      <WalletTransactionList
        transactions={filteredTransactions}
        loading={transactionsLoading}
        totalCount={
          historyFilter === "all"
            ? transactions.length
            : transactions.filter((tx) => mapTxCategory(tx.type) === historyFilter).length
        }
        visibleCount={filteredTransactions.length}
        onLoadMore={() => setTxLimit((prev) => prev + 10)}
        intlLocale={intlLocale}
        t={t}
      />
      <RulesModal
        visible={isRulesVisible}
        onClose={() => setIsRulesVisible(false)}
        initialPage={3}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  sectionTitle: {
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  guideCard: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 14,
    gap: 6,
  },
  secondaryLinkButton: {
    marginTop: 8,
  },
  modeCard: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  quickChip: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    minHeight: 34,
    minWidth: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    marginTop: 8,
  },
  lookupRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
  },
  lookupInputWrap: {
    flex: 1,
  },
  infoBox: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 4,
  },
  receiveHandle: {
    marginTop: 6,
  },
  feeButton: {
    marginTop: 4,
    marginBottom: 4,
  },
  historyHeader: {
    marginTop: 24,
  },
});
