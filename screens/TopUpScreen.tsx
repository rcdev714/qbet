import {
  AppButton,
  AppInput,
  AppScreen,
  AppText,
  FieldGroup,
} from "@/components/ui";
import { BackButton } from "@/components/ui/BackButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { isAppAdmin } from "@/lib/admin";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { GlobalHeader } from "@/components/GlobalHeader";
import { RulesModal } from "@/components/profile/RulesModal";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useWalletContext } from "@/contexts/WalletContext";
import { formatCurrency } from "@/lib/parimutuel";
import { isStripeNativeAvailable, useStripe } from "@/lib/stripe-bridge";
import { walletService } from "@/services/wallet.service";

const PREDEFINED_AMOUNTS = [10, 20, 50, 100];

export function TopUpScreen() {
  const router = useRouter();
  const stripe = useStripe();
  const { user } = useAuthContext();
  const { theme, isDark } = useTheme();
  const {
    balance,
    isPlayMode,
    liveWalletReady,
    requestLiveMode,
    withdrawToStripe,
  } = useWalletContext();
  const [walletAction, setWalletAction] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState<string>("");
  const [transactionLimit, setTransactionLimit] = useState(10);

  const isAdmin = isAppAdmin(user);
  const MIN_DEPOSIT = isAdmin ? 1 : 10;
  const MIN_WITHDRAWAL = isAdmin ? 1 : 15;
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [isRulesVisible, setIsRulesVisible] = useState(false);
  const [rulesInitialPage, setRulesInitialPage] = useState(0);

  const calculateFee = (amt: number): { feeAmount: number; feePercent: number } => {
    if (amt <= 0) return { feeAmount: 0, feePercent: 0 };
    const rawPercent = 0.41 / Math.pow(amt, 0.44);
    const feePercent = Math.min(0.15, Math.max(0.02, rawPercent));
    return { feeAmount: amt * feePercent, feePercent };
  };

  useEffect(() => {
    loadTransactions();

    let channel: any = null;
    if (user?.id) {
      channel = walletService.subscribeToTransactions(user.id, () => {
        loadTransactions();
      });
    }

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [user, isPlayMode]);

  useEffect(() => {
    const handleDeepLink = (url: string | null) => {
      if (!url) return;
      try {
        const parsed = new URL(url);
        const status = parsed.searchParams.get("status");
        if (status === "complete" || status === "return") {
          Alert.alert(
            "Onboarding Complete",
            "Your Stripe account is onboarded. You can proceed to withdraw funds.",
          );
        }
      } catch (error) {
        console.warn("Failed to parse deep link:", error);
      }
    };

    const subscription = Linking.addEventListener("url", (event) => {
      handleDeepLink(event.url);
    });

    Linking.getInitialURL().then(handleDeepLink).catch((error) => {
      console.warn("Failed to get initial URL:", error);
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const canceled = params.get("canceled");
    const onboarding = params.get("onboarding");

    if (success === "true") {
      Alert.alert("Success", "Wallet topped up! Your balance will update shortly.");
      window.history.replaceState({}, "", window.location.pathname);
      setTimeout(() => {
        loadTransactions();
      }, 2000);
    } else if (canceled === "true") {
      Alert.alert("Canceled", "Payment was canceled.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (onboarding === "complete") {
      Alert.alert(
        "Onboarding Complete",
        "Your bank account has been set up. You can now withdraw funds!",
      );
      setWalletAction("withdraw");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (onboarding === "refresh") {
      Alert.alert(
        "Onboarding Incomplete",
        "Please try the withdrawal again to continue setting up your bank account.",
      );
      setWalletAction("withdraw");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const loadTransactions = async () => {
    if (!user?.id) return;
    setTransactionsLoading(true);
    const data = await walletService.getTransactions(user.id, isPlayMode);
    setTransactions(data);
    setTransactionsLoading(false);
  };

  const handleTopUp = async () => {
    if (isPlayMode) {
      void requestLiveMode();
      return;
    }
    if (!liveWalletReady) {
      void requestLiveMode();
      return;
    }
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount.");
      return;
    }

    if (Platform.OS === "web") {
      if (!user?.id) {
        Alert.alert("Error", "Please log in to add funds.");
        return;
      }

      setLoading(true);
      const result = await walletService.createCheckoutSession(
        Math.round(value * 100),
        user.id,
      );
      setLoading(false);

      if (result?.url) {
        window.location.href = result.url;
      } else {
        Alert.alert("Error", "Failed to initialize payment.");
      }
      return;
    }

    if (!isStripeNativeAvailable) {
      Alert.alert(
        "Development Mode",
        "Stripe is not available in Expo Go. Please use a development build.",
      );
      return;
    }

    setLoading(true);
    const response = await walletService.createPaymentIntent(
      Math.round(value * 100),
      user?.email || undefined,
      user?.id,
    );

    if (!response) {
      setLoading(false);
      Alert.alert("Error", "Failed to initialize payment.");
      return;
    }

    const { paymentIntent, ephemeralKey, customer } = response;
    const { error: initError } = await stripe.initPaymentSheet({
      merchantDisplayName: "Qbet",
      customerId: customer,
      customerEphemeralKeySecret: ephemeralKey,
      paymentIntentClientSecret: paymentIntent,
      returnURL: "qbet://wallet",
      allowsDelayedPaymentMethods: true,
    });

    if (initError) {
      setLoading(false);
      Alert.alert("Error", initError.message);
      return;
    }

    const { error: presentError } = await stripe.presentPaymentSheet();
    setLoading(false);

    if (presentError) {
      Alert.alert("Error", presentError.message);
    } else {
      Alert.alert("Success", "Wallet topped up!");
      setAmount("");
      loadTransactions();
    }
  };

  const handleAmountChange = (text: string) => {
    let cleaned = text.replace(/[^0-9.]/g, "");

    const parts = cleaned.split(".");
    if (parts.length > 2) {
      cleaned = parts[0] + "." + parts.slice(1).join("");
    }

    if (parts.length === 2 && parts[1].length > 2) {
      cleaned = parts[0] + "." + parts[1].slice(0, 2);
    }

    setAmount(cleaned);
  };

  const handleStripeWithdrawal = async () => {
    if (isPlayMode || !liveWalletReady) {
      void requestLiveMode();
      return;
    }
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount to withdraw.");
      return;
    }

    if (value > balance) {
      Alert.alert("Insufficient Balance", `You only have ${formatCurrency(balance)} available.`);
      return;
    }

    setLoading(true);
    const result = await withdrawToStripe(Math.round(value * 100));
    setLoading(false);

    if (result.success) {
      if (result.needsOnboarding) {
        if (Platform.OS === "web") {
          window.location.href = result.needsOnboarding;
          return;
        }
        Alert.alert(
          "Setup Required",
          "You need to set up your bank account details to receive payouts.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Continue to Stripe",
              onPress: () => {
                Linking.openURL(result.needsOnboarding!);
              },
            },
          ],
        );
      } else {
        Alert.alert("Withdrawal Requested", "Funds are on the way to your bank account!", [
          {
            text: "OK",
            onPress: () => {
              setAmount("");
              router.back();
              loadTransactions();
            },
          },
        ]);
      }
    } else {
      Alert.alert("Withdrawal Failed", result.error || "Please try again later.");
    }
  };

  const renderQuickAmounts = () => (
    <View style={styles.quickRow}>
      {PREDEFINED_AMOUNTS.map((val) => {
        const selected = amount === val.toString();
        return (
          <Pressable
            key={val}
            accessibilityRole="button"
            accessibilityLabel={`$${val}`}
            onPress={() => {
              Haptics.selectionAsync();
              setAmount(val.toString());
            }}
            style={[
              styles.quickChip,
              {
                backgroundColor: selected ? theme.primary : theme.muted,
                borderRadius: theme.radius.pill,
              },
            ]}
          >
            <AppText variant="label" color={selected ? "onPrimary" : "default"}>
              ${val}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );

  const renderTransactions = () => {
    if (transactionsLoading) {
      return <ActivityIndicator style={styles.loader} color={theme.text} />;
    }

    if (transactions.length === 0) {
      return (
        <View style={styles.emptyHistory}>
          <AppText variant="body" color="secondary">
            No transactions yet
          </AppText>
        </View>
      );
    }

    const visibleTransactions = transactions.slice(0, transactionLimit);
    const hasMore = transactions.length > transactionLimit;
    const canShowLess = transactionLimit > 10;

    return (
      <>
        {visibleTransactions.map((tx: any, index: number) => {
          const isPositive = tx.amount > 0;
          const date = new Date(tx.created_at).toLocaleDateString();
          let title = "Transaction";
          let subtitle = date;

          if (tx.type === "deposit") title = "Top Up";
          else if (tx.type === "withdrawal") title = "Withdrawal";
          else if (tx.type === "bet_placed") {
            title = "Bet Placed";
            if (tx.metadata?.option_label) {
              subtitle = `${tx.metadata.option_label} • ${date}`;
            }
          } else if (tx.type === "bet_won") {
            title = "Winnings";
            if (tx.metadata?.market_question) {
              subtitle = `${tx.metadata.market_question} • ${date}`;
            }
          } else if (tx.type === "bet_lost") {
            title = "Bet Lost";
            if (tx.metadata?.market_question) {
              const wager = tx.metadata?.wager ? formatCurrency(tx.metadata.wager) : "";
              subtitle = `${wager ? `Wager: ${wager} • ` : ""}${tx.metadata.market_question} • ${date}`;
            }
          }

          return (
            <View
              key={tx.id}
              style={[
                styles.txRow,
                {
                  borderBottomColor: theme.border,
                  borderBottomWidth:
                    index === visibleTransactions.length - 1 ? 0 : StyleSheet.hairlineWidth,
                },
              ]}
            >
              <View style={styles.txMain}>
                <AppText variant="body">{title}</AppText>
                <AppText variant="caption" color="secondary" numberOfLines={1}>
                  {subtitle}
                </AppText>
              </View>
              <AppText
                variant="body"
                color={
                  isPositive ? "success" : tx.type === "bet_lost" ? "secondary" : "default"
                }
              >
                {isPositive ? "+" : ""}
                {formatCurrency(tx.amount)}
              </AppText>
            </View>
          );
        })}

        {(hasMore || canShowLess) && (
          <View style={[styles.pagerRow, { borderTopColor: theme.border }]}>
            {canShowLess ? (
              <AppButton
                title="See Less"
                variant="ghost"
                onPress={() => {
                  Haptics.selectionAsync();
                  setTransactionLimit(10);
                }}
                style={styles.pagerButton}
              />
            ) : null}

            {canShowLess && hasMore ? (
              <View style={[styles.pagerDivider, { backgroundColor: theme.border }]} />
            ) : null}

            {hasMore ? (
              <View style={styles.pagerMore}>
                <AppButton
                  title="See More"
                  variant="ghost"
                  onPress={() => {
                    Haptics.selectionAsync();
                    setTransactionLimit((prev) => prev + 10);
                  }}
                  style={styles.pagerButton}
                />
                <AppText variant="caption" color="secondary">
                  {visibleTransactions.length} of {transactions.length}
                </AppText>
              </View>
            ) : null}
          </View>
        )}
      </>
    );
  };

  const parsedAmount = parseFloat(amount);
  const feeDetails =
    !isNaN(parsedAmount) && parsedAmount > 0 ? calculateFee(parsedAmount) : null;

  return (
    <>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <AppScreen maxWidth="narrow" scroll>
        <GlobalHeader left={<BackButton />} />

        <View
          style={[
            styles.balanceSection,
            { backgroundColor: theme.surface, borderBottomColor: theme.border },
          ]}
        >
          <AppText variant="label" color="secondary" style={styles.balanceLabel}>
            {isPlayMode ? "Play Balance" : "Live Balance"}
          </AppText>
          <AppText variant="display" style={styles.balanceAmount}>
            {formatCurrency(balance)}
          </AppText>
          {isPlayMode ? (
            <AppText variant="bodySm" color="secondary" style={styles.playModeNote}>
              Trial credits for practice only.
            </AppText>
          ) : null}
        </View>

        {isPlayMode ? (
          <View style={styles.sectionContainer}>
            <AppButton title="Switch to Live Mode" onPress={() => void requestLiveMode()} />
          </View>
        ) : (
          <>
            <View style={[styles.tabSection, { borderBottomColor: theme.border }]}>
              <SegmentedControl
                value={walletAction}
                segments={[
                  { value: "deposit", label: "Add Funds" },
                  { value: "withdraw", label: "Withdraw" },
                ]}
                onChange={setWalletAction}
              />
            </View>

            <View style={styles.actionContainer}>
              {walletAction === "deposit" ? (
                <View>
                  <AppText variant="label" color="secondary" style={styles.sectionTitle}>
                    Select Amount
                  </AppText>
                  {renderQuickAmounts()}

                  <FieldGroup>
                    <AppInput
                      testID="topup-amount"
                      label="Custom Amount"
                      value={amount}
                      onChangeText={handleAmountChange}
                      placeholder={`Min $${MIN_DEPOSIT}`}
                      keyboardType="decimal-pad"
                    />
                  </FieldGroup>

                  {amount && parsedAmount > 0 && parsedAmount < MIN_DEPOSIT ? (
                    <AppText variant="caption" color="destructive" style={styles.minHint}>
                      Minimum deposit is ${MIN_DEPOSIT}.00
                    </AppText>
                  ) : null}

                  <AppButton
                    testID="topup-submit"
                    title="Add Funds"
                    loading={loading}
                    disabled={loading || (!!amount && parsedAmount < MIN_DEPOSIT)}
                    onPress={() => {
                      if (parsedAmount < MIN_DEPOSIT) {
                        Alert.alert(
                          "Minimum Deposit",
                          `The minimum deposit amount is $${MIN_DEPOSIT}.00`,
                        );
                        return;
                      }
                      handleTopUp();
                    }}
                    style={styles.primaryButton}
                  />
                </View>
              ) : (
                <View>
                  <FieldGroup>
                    <AppInput
                      label="Withdraw Amount"
                      value={amount}
                      onChangeText={handleAmountChange}
                      placeholder={`Min $${MIN_WITHDRAWAL}`}
                      keyboardType="decimal-pad"
                    />
                  </FieldGroup>

                  {amount && feeDetails ? (
                    <View
                      style={[
                        styles.receiptContainer,
                        {
                          backgroundColor: theme.muted,
                          borderColor: theme.border,
                          borderRadius: theme.radius.lg,
                        },
                      ]}
                    >
                      {parsedAmount < MIN_WITHDRAWAL ? (
                        <View
                          style={[
                            styles.minWarning,
                            {
                              backgroundColor: theme.primarySoft,
                              borderRadius: theme.radius.sm,
                            },
                          ]}
                        >
                          <AppText variant="caption" color="destructive" style={styles.centered}>
                            Minimum withdrawal amount is ${MIN_WITHDRAWAL}.00
                          </AppText>
                        </View>
                      ) : null}

                      <AppText variant="caption" color="secondary" style={styles.receiptTitle}>
                        Transaction details
                      </AppText>

                      <View style={styles.receiptRow}>
                        <AppText variant="bodySm">Withdrawal Amount</AppText>
                        <AppText variant="bodySm">${parsedAmount.toFixed(2)}</AppText>
                      </View>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="View platform fee details"
                        onPress={() => {
                          setRulesInitialPage(3);
                          setIsRulesVisible(true);
                        }}
                        style={styles.receiptRow}
                      >
                        <AppText variant="bodySm" color="secondary">
                          Platform Fee ({Math.round(feeDetails.feePercent * 100)}%) ⓘ
                        </AppText>
                        <AppText variant="bodySm" color="secondary">
                          -${feeDetails.feeAmount.toFixed(2)}
                        </AppText>
                      </Pressable>

                      <View style={[styles.receiptDivider, { backgroundColor: theme.border }]} />

                      <View style={styles.receiptRow}>
                        <AppText variant="body">Estimated Payout</AppText>
                        <AppText variant="body" color="success">
                          ${(parsedAmount - feeDetails.feeAmount).toFixed(2)}
                        </AppText>
                      </View>

                      <AppText variant="caption" color="secondary" style={styles.receiptNote}>
                        Funds typically arrive in 2-3 business days.
                      </AppText>
                    </View>
                  ) : null}

                  <AppButton
                    title="Confirm Withdrawal"
                    loading={loading}
                    disabled={loading || (!!amount && parsedAmount < MIN_WITHDRAWAL)}
                    onPress={() => {
                      if (parsedAmount < MIN_WITHDRAWAL) {
                        Alert.alert(
                          "Minimum Withdrawal",
                          `The minimum withdrawal amount is $${MIN_WITHDRAWAL}.00`,
                        );
                        return;
                      }
                      handleStripeWithdrawal();
                    }}
                    style={styles.primaryButton}
                  />
                </View>
              )}
            </View>
          </>
        )}

        <View style={styles.sectionHeader}>
          <AppText variant="label" color="secondary">
            Recent Activity
          </AppText>
        </View>
        <View
          style={[
            styles.historyList,
            {
              backgroundColor: theme.surface,
              borderTopColor: theme.border,
              borderBottomColor: theme.border,
            },
          ]}
        >
          {renderTransactions()}
        </View>
      </AppScreen>

      <RulesModal
        visible={isRulesVisible}
        onClose={() => setIsRulesVisible(false)}
        initialPage={rulesInitialPage}
      />
    </>
  );
}

const styles = StyleSheet.create({
  balanceSection: {
    alignItems: "center",
    paddingVertical: 32,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginHorizontal: -16,
    marginBottom: 0,
  },
  balanceLabel: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  balanceAmount: {
    marginTop: 4,
    letterSpacing: -1,
  },
  playModeNote: {
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  tabSection: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  actionContainer: {
    paddingVertical: 20,
  },
  sectionTitle: {
    textTransform: "uppercase",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  quickRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  quickChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  minHint: {
    marginTop: 8,
  },
  primaryButton: {
    marginTop: 24,
  },
  receiptContainer: {
    marginTop: 20,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  minWarning: {
    marginBottom: 8,
    padding: 8,
  },
  centered: {
    textAlign: "center",
  },
  receiptTitle: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  receiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  receiptDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  receiptNote: {
    marginTop: 4,
    fontStyle: "italic",
  },
  sectionHeader: {
    marginTop: 32,
    marginBottom: 8,
  },
  sectionContainer: {
    paddingVertical: 20,
  },
  historyList: {
    marginHorizontal: -16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  loader: {
    marginTop: 20,
  },
  emptyHistory: {
    alignItems: "center",
    marginTop: 40,
    paddingBottom: 40,
  },
  txRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  txMain: {
    flex: 1,
    marginRight: 8,
    gap: 2,
  },
  pagerRow: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pagerButton: {
    flex: 1,
  },
  pagerDivider: {
    width: StyleSheet.hairlineWidth,
  },
  pagerMore: {
    flex: 1,
    alignItems: "center",
  },
});
