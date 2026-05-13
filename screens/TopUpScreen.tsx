import { isAdminEmail } from "@/lib/admin";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
  View
} from "react-native";
import { GlobalHeader } from "../components/GlobalHeader";
import { RulesModal } from "../components/profile/RulesModal";
import { useAuthContext } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useWalletContext } from "../contexts/WalletContext";
import { formatCurrency } from "../lib/parimutuel";
import { walletService } from "../services/wallet.service";

const PREDEFINED_AMOUNTS = [10, 20, 50, 100];

import { isStripeNativeAvailable, useStripe } from "../lib/stripe-bridge";

export function TopUpScreen() {
  const router = useRouter();
  const stripe = useStripe();
  const { user } = useAuthContext();
  const { theme, isDark } = useTheme();
  const { 
    balance, 
    liveBalance, 
    playBalance, 
    isPlayMode, 
    toggleMode, 
    withdrawToStripe 
  } = useWalletContext();
  const [walletAction, setWalletAction] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState<string>("");
  const [transactionLimit, setTransactionLimit] = useState(10);

  const isAdmin = isAdminEmail(user?.email);
  const MIN_DEPOSIT = isAdmin ? 1 : 10;
  const MIN_WITHDRAWAL = isAdmin ? 1 : 15;
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [isRulesVisible, setIsRulesVisible] = useState(false);
  const [rulesInitialPage, setRulesInitialPage] = useState(0);
  
  // Smooth curve fee calculation: fee% = 0.41 / amount^0.44, clamped 2%-15%
  // $10→15%, $50→8%, $100→6%, $500→3%, $1000→2%
  const calculateFee = (amt: number): { feeAmount: number; feePercent: number } => {
    if (amt <= 0) return { feeAmount: 0, feePercent: 0 };
    const rawPercent = 0.41 / Math.pow(amt, 0.44);
    const feePercent = Math.min(0.15, Math.max(0.02, rawPercent));
    return { feeAmount: amt * feePercent, feePercent };
  };

  // Header is controlled by expo-router layout

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
            "Your Stripe account is onboarded. You can proceed to withdraw funds."
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

  // Web: Detect success/cancel from Stripe Checkout redirect
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const canceled = params.get('canceled');
    const onboarding = params.get('onboarding');
    
    if (success === 'true') {
      Alert.alert("Success", "Wallet topped up! Your balance will update shortly.");
      // Clean URL parameters
      window.history.replaceState({}, '', window.location.pathname);
      // Reload transactions after a brief delay to allow webhook processing
      setTimeout(() => {
        loadTransactions();
      }, 2000);
    } else if (canceled === 'true') {
      Alert.alert("Canceled", "Payment was canceled.");
      window.history.replaceState({}, '', window.location.pathname);
    } else if (onboarding === 'complete') {
      Alert.alert(
        "Onboarding Complete",
        "Your bank account has been set up. You can now withdraw funds!"
      );
      setWalletAction('withdraw');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (onboarding === 'refresh') {
      Alert.alert(
        "Onboarding Incomplete",
        "Please try the withdrawal again to continue setting up your bank account."
      );
      setWalletAction('withdraw');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);



  const loadTransactions = async () => {
    if (!user?.id) return;
    setTransactionsLoading(true);
    // Filter transactions by current mode
    const data = await walletService.getTransactions(user.id, isPlayMode);
    setTransactions(data);
    setTransactionsLoading(false);
  };


  const handleTopUp = async () => {
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount.");
      return;
    }

    const isWeb = Platform.OS === 'web';

    // Web: Use Stripe Checkout redirect
    if (isWeb) {
      if (!user?.id) {
        Alert.alert("Error", "Please log in to add funds.");
        return;
      }

      setLoading(true);
      const result = await walletService.createCheckoutSession(
        Math.round(value * 100),
        user.id
      );
      setLoading(false);

      if (result?.url) {
        // Redirect to Stripe Checkout
        window.location.href = result.url;
      } else {
        Alert.alert("Error", "Failed to initialize payment.");
      }
      return;
    }

    // iOS: Use native PaymentSheet
    if (!isStripeNativeAvailable) {
      Alert.alert("Development Mode", "Stripe is not available in Expo Go. Please use a development build.");
      return;
    }

    setLoading(true);
    const response = await walletService.createPaymentIntent(Math.round(value * 100), user?.email || undefined, user?.id);

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
      loadTransactions(); // Reload transactions
    }
  };

  const handleAmountChange = (text: string) => {
    // Remove any character that is not a digit or a dot
    let cleaned = text.replace(/[^0-9.]/g, '');
    
    // Ensure only one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Restrict to 2 decimal places for currency
    if (parts.length === 2 && parts[1].length > 2) {
      cleaned = parts[0] + '.' + parts[1].slice(0, 2);
    }
    
    setAmount(cleaned);
  };

  const handleStripeWithdrawal = async () => {
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
    // Convert logic: function expects cents if using same logic as tutorial (which took amount)
    // Wait, tutorial function: const { amount } = req.json() // amount in cents.
    // My implemented function: const { amount } = await req.json(); // amount in cents
    // So I need to send cents.
    const result = await withdrawToStripe(Math.round(value * 100));
    setLoading(false);

    if (result.success) {
      if (result.needsOnboarding) {
        if (Platform.OS === 'web') {
          // On web, redirect directly to Stripe onboarding
          window.location.href = result.needsOnboarding;
          return;
        }
        Alert.alert(
          "Setup Required",
          "You need to set up your bank account details to receive payouts.",
          [
            {
              text: "Cancel",
              style: "cancel"
            },
            {
              text: "Continue to Stripe",
              onPress: () => {
                Linking.openURL(result.needsOnboarding!);
              }
            }
          ]
        );
      } else {
        Alert.alert(
          "Withdrawal Requested",
          "Funds are on the way to your bank account!",
          [{
            text: "OK", onPress: () => {
              setAmount("");
              router.back();
              loadTransactions();
            }
          }]
        );
      }
    } else {
      Alert.alert("Withdrawal Failed", result.error || "Please try again later.");
    }
  };

  const renderTransactions = () => {
    if (transactionsLoading) {
      return <ActivityIndicator style={{ marginTop: 20 }} color={theme.text} />;
    }

    if (transactions.length === 0) {
      return (
        <View style={{ alignItems: 'center', marginTop: 40, paddingBottom: 40 }}>
          <Text style={{ color: theme.textSecondary, fontSize: 16 }}>No transactions yet</Text>
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

          if (tx.type === 'deposit') title = "Top Up";
          else if (tx.type === 'withdrawal') title = "Withdrawal";
          else if (tx.type === 'bet_placed') {
            title = "Bet Placed";
            if (tx.metadata?.option_label) {
              subtitle = `${tx.metadata.option_label} • ${date}`;
            }
          }
          else if (tx.type === 'bet_won') {
            title = "Winnings";
            if (tx.metadata?.market_question) {
              subtitle = `${tx.metadata.market_question} • ${date}`;
            }
          }
          else if (tx.type === 'bet_lost') {
            title = "Bet Lost";
            if (tx.metadata?.market_question) {
              const wager = tx.metadata?.wager ? formatCurrency(tx.metadata.wager) : '';
              subtitle = `${wager ? `Wager: ${wager} • ` : ''}${tx.metadata.market_question} • ${date}`;
            }
          }

          // Last item border logic:
          // If we show "See More" or "See Less", the last item should NOT have a border (the button container has top border)
          // If we are at the end and NO buttons are shown (e.g. limit > length but length < limit? No, limit >= length), 
          // wait, if hasMore is false AND canShowLess is false (i.e. minimal list fit in one page), then we might want border?
          // Actually, standard list items usually have separator borders. Last item usually doesn't.
          // The container has borderTop/borderBottom.
          // Let's stick to: validation: index === visibleTransactions.length - 1 -> no border.
          // BUT, if there are buttons below, the buttons have a border top.
          // If I return `null` for borderBottomWidth, it uses default? No.
          
          return (
            <View key={tx.id} style={[styles.txRow, index === visibleTransactions.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.txType, { color: theme.text }]}>{title}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 13, marginRight: 8 }} numberOfLines={1}>
                  {subtitle}
                </Text>
              </View>
              <Text style={[
                styles.txAmount,
                { color: isPositive ? '#34C759' : (tx.type === 'bet_lost' ? theme.textSecondary : theme.text) }
              ]}>
                {isPositive ? '+' : ''}{formatCurrency(tx.amount)}
              </Text>
            </View>
          );
        })}

        {(hasMore || canShowLess) && (
          <View style={{ flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }}>
             {canShowLess && (
                <TouchableOpacity 
                    style={[styles.seeMoreButton, { flex: 1, borderTopWidth: 0 }]}
                    onPress={() => {
                        Haptics.selectionAsync();
                        setTransactionLimit(10);
                    }}
                >
                    <Text style={[styles.seeMoreText, { color: theme.primary }]}>See Less</Text>
                </TouchableOpacity>
             )}
             
             {canShowLess && hasMore && (
                 <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: theme.border }} />
             )}

             {hasMore && (
                <TouchableOpacity 
                    style={[styles.seeMoreButton, { flex: 1, borderTopWidth: 0 }]}
                    onPress={() => {
                        Haptics.selectionAsync();
                        setTransactionLimit(prev => prev + 10);
                    }}
                >
                    <Text style={[styles.seeMoreText, { color: theme.primary }]}>See More</Text>
                    <Text style={[styles.seeMoreSubtext, { color: theme.textSecondary }]}>
                    {visibleTransactions.length} of {transactions.length}
                    </Text>
                </TouchableOpacity>
             )}
          </View>
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <GlobalHeader
        ignoreTopInset
        left={
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButtonLeft}>
            <Text style={[styles.backButtonText, { color: theme.primary }]}>←</Text>
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0} 
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            Platform.OS === 'web' && { maxWidth: 600, alignSelf: 'center', width: '100%' } as any
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Balance Section */}
          <View style={[styles.balanceSection, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
            <Text style={styles.balanceLabel}>{isPlayMode ? 'Play Balance' : 'Live Balance'}</Text>
            <Text style={[styles.balanceAmount, { color: theme.text }]}>
              {formatCurrency(balance)}
            </Text>
            {isPlayMode && (
                 <Text style={[styles.playModeNote, { color: theme.textSecondary }]}>
                  Trial credits for practice only.
                 </Text>
            )}
          </View>

          {isPlayMode ? (
             <View style={styles.sectionContainer}>
                <TouchableOpacity 
                    style={[styles.primaryButton, { backgroundColor: '#007AFF', marginTop: 24 }, Platform.OS === 'web' && { cursor: 'pointer' } as any]} 
                    onPress={toggleMode}
                >
                    <Text style={[styles.primaryButtonText, { color: '#fff' }]}>
                        Switch to Live Mode
                    </Text>
                </TouchableOpacity>
             </View>
          ) : (
            <>
              {/* Tabs */}
              <View style={[styles.tabContainer, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
                <TouchableOpacity 
                  style={[styles.tabButton, walletAction === 'deposit' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
                  onPress={() => setWalletAction('deposit')}
                >
                  <Text style={[styles.tabText, { color: walletAction === 'deposit' ? theme.primary : theme.textSecondary }]}>Add Funds</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.tabButton, walletAction === 'withdraw' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
                  onPress={() => setWalletAction('withdraw')}
                >
                  <Text style={[styles.tabText, { color: walletAction === 'withdraw' ? theme.primary : theme.textSecondary }]}>Withdraw</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.actionContainer}>
                  {walletAction === 'deposit' ? (
                    /* Deposit Section */
                    <View>
                        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Select Amount</Text>
                        
                        <View style={styles.quickBetContainer}>
                            {PREDEFINED_AMOUNTS.map(val => (
                            <TouchableOpacity
                                key={val}
                                style={[
                                    styles.quickBetChip, 
                                    { backgroundColor: isDark ? '#1C1C1E' : '#E5E5EA' },
                                    amount === val.toString() && { backgroundColor: theme.primary }
                                ]}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setAmount(val.toString());
                                }}
                            >
                                <Text style={[
                                    styles.quickBetText, 
                                    { color: theme.text },
                                    amount === val.toString() && { color: '#fff' }
                                ]}>${val}</Text>
                            </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: 16 }]}>Custom Amount</Text>
                         <TextInput
                            style={[
                                styles.input, 
                                { backgroundColor: isDark ? theme.background : "#F2F2F7", color: theme.text },
                                Platform.OS === 'web' && { cursor: 'text' } as any
                            ]}
                            value={amount}
                            onChangeText={handleAmountChange}
                            placeholder={`Min $${MIN_DEPOSIT}`}
                            placeholderTextColor={theme.textSecondary}
                            keyboardType="decimal-pad"
                        />

                        {amount && parseFloat(amount) > 0 && parseFloat(amount) < MIN_DEPOSIT && (
                            <Text style={{ color: theme.error, marginTop: 8, fontSize: 13 }}>
                            Minimum deposit is ${MIN_DEPOSIT}.00
                            </Text>
                        )}

                        <TouchableOpacity 
                            style={[
                                styles.primaryButton, 
                                { 
                                    opacity: (parseFloat(amount) < MIN_DEPOSIT) ? 0.5 : 1,
                                    backgroundColor: theme.primary,
                                    marginTop: 24
                                }, 
                                Platform.OS === 'web' && { cursor: 'pointer' } as any
                            ]} 
                            onPress={() => {
                            if (parseFloat(amount) < MIN_DEPOSIT) {
                                Alert.alert("Minimum Deposit", `The minimum deposit amount is $${MIN_DEPOSIT}.00`);
                                return;
                            }
                            handleTopUp();
                            }} 
                            disabled={loading || (!!amount && parseFloat(amount) < MIN_DEPOSIT)}
                        >
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Add Funds</Text>}
                        </TouchableOpacity>
                    </View>
                  ) : (
                    /* Withdraw Section */
                    <View>
                        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Withdraw Amount</Text>
                        <TextInput
                            style={[
                                styles.input, 
                                { backgroundColor: isDark ? theme.background : "#F2F2F7", color: theme.text },
                                Platform.OS === 'web' && { cursor: 'text' } as any
                            ]}
                            value={amount}
                            onChangeText={handleAmountChange}
                            placeholder={`Min $${MIN_WITHDRAWAL}`}
                            placeholderTextColor={theme.textSecondary}
                            keyboardType="decimal-pad"
                        />

                         {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && (
                            <View style={[styles.receiptContainer, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7', borderColor: theme.border }]}>
                                {parseFloat(amount) < MIN_WITHDRAWAL && (
                                <View style={{ marginBottom: 16, backgroundColor: isDark ? '#3A2E2E' : '#FFF5F5', padding: 8, borderRadius: 8 }}>
                                    <Text style={{ color: theme.error, textAlign: 'center', fontSize: 13, fontWeight: '400' }}>
                                    Minimum withdrawal amount is ${MIN_WITHDRAWAL}.00
                                    </Text>
                                </View>
                                )}
                                
                                <Text style={[styles.receiptTitle, { color: theme.textSecondary }]}>TRANSACTION DETAILS</Text>

                                <View style={styles.receiptRow}>
                                <Text style={[styles.receiptLabel, { color: theme.text }]}>Withdrawal Amount</Text>
                                <Text style={[styles.receiptValue, { color: theme.text }]}>${parseFloat(amount).toFixed(2)}</Text>
                                </View>

                                <TouchableOpacity 
                                style={styles.receiptRow}
                                onPress={() => {
                                    setRulesInitialPage(3); // Fees & Withdrawals page
                                    setIsRulesVisible(true);
                                }}
                                >
                                <Text style={[styles.receiptLabel, { color: theme.textSecondary }]}>
                                    Platform Fee ({Math.round(calculateFee(parseFloat(amount)).feePercent * 100)}%) ⓘ
                                </Text>
                                <Text style={[styles.receiptValue, { color: theme.textSecondary }]}>
                                    -${calculateFee(parseFloat(amount)).feeAmount.toFixed(2)}
                                </Text>
                                </TouchableOpacity>

                                <View style={[styles.receiptDivider, { backgroundColor: theme.border }]} />

                                <View style={styles.receiptRow}>
                                <Text style={[styles.receiptLabel, { color: theme.text, fontWeight: '600', fontSize: 15 }]}>Estimated Payout</Text>
                                <Text style={[styles.receiptValue, { color: '#34C759', fontWeight: '600', fontSize: 16 }]}>
                                    ${(parseFloat(amount) - calculateFee(parseFloat(amount)).feeAmount).toFixed(2)}
                                </Text>
                                </View>

                                <View style={styles.receiptFooter}>
                                <Text style={[styles.receiptNote, { color: theme.textSecondary }]}>
                                    Funds typically arrive in 2-3 business days.
                                </Text>
                                </View>
                            </View>
                        )}
                        
                         <TouchableOpacity 
                            style={[
                                styles.primaryButton, 
                                { 
                                    opacity: (parseFloat(amount) < MIN_WITHDRAWAL) ? 0.5 : 1,
                                    backgroundColor: theme.primary,
                                    marginTop: 24
                                }, 
                                Platform.OS === 'web' && { cursor: 'pointer' } as any
                            ]} 
                            onPress={() => {
                                if (parseFloat(amount) < MIN_WITHDRAWAL) {
                                Alert.alert("Minimum Withdrawal", `The minimum withdrawal amount is $${MIN_WITHDRAWAL}.00`);
                                return;
                                }
                                handleStripeWithdrawal();
                            }} 
                            disabled={loading || (!!amount && parseFloat(amount) < MIN_WITHDRAWAL)}
                        >
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Confirm Withdrawal</Text>}
                        </TouchableOpacity>
                    </View>
                  )}
              </View>
            </>
          )}

          {/* Transaction History Header */}
           <View style={[styles.sectionHeader, { marginTop: 32 }]}>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginBottom: 0 }]}>RECENT ACTIVITY</Text>
           </View>
           <View style={[styles.historyList, { backgroundColor: theme.surface, borderTopColor: theme.border, borderBottomColor: theme.border }]}>
                {renderTransactions()}
           </View>

        </ScrollView>
      </KeyboardAvoidingView>
      <RulesModal 
        visible={isRulesVisible} 
        onClose={() => setIsRulesVisible(false)} 
        initialPage={rulesInitialPage}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7"
  },
  headerButtonLeft: {
    padding: 8,
    marginLeft: -8,
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: "300",
  },
  content: {
    paddingBottom: 40,
  },
  balanceSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#C6C6C8',
    marginBottom: 0,
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  balanceAmount: {
    fontSize: 44,
    fontWeight: '300', // Thin, elegant
    color: '#000',
    marginTop: 4,
    letterSpacing: -1,
  },
  playModeNote: {
      marginTop: 8,
      fontSize: 13,
      textAlign: 'center',
      paddingHorizontal: 32
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
    backgroundColor: '#fff',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '400',
  },
  actionContainer: {
      padding: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "400",
    color: "#8E8E93",
    textTransform: "uppercase",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  quickBetContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  quickBetChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center'
  },
  quickBetText: {
    fontSize: 15,
    fontWeight: '400',
  },
  input: {
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 17,
    fontWeight: "400",
    color: "#000",
    height: 50,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: 'center',
    height: 50,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600', // Elegant
    fontSize: 16
  },
  receiptContainer: {
      marginTop: 20,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
  },
  receiptTitle: {
      fontSize: 11,
      fontWeight: '600',
      marginBottom: 12,
      letterSpacing: 0.5
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  receiptLabel: {
      fontSize: 14,
  },
  receiptValue: {
      fontSize: 14,
      fontWeight: '400'
  },
  receiptDivider: {
      height: StyleSheet.hairlineWidth,
      marginVertical: 12
  },
  receiptFooter: {
      marginTop: 8
  },
  receiptNote: {
      fontSize: 12,
      fontStyle: 'italic'
  },
  sectionHeader: {
      paddingHorizontal: 20,
      marginBottom: 8
  },
  historyList: {
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#C6C6C8',
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  txType: {
    fontSize: 16,
    fontWeight: '400',
    color: '#000',
    marginBottom: 2
  },
  txAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionContainer: {
      padding: 20
  },
  seeMoreButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  seeMoreText: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  seeMoreSubtext: {
    fontSize: 12,
  },
});
