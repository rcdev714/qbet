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
  const { addFunds, withdrawToStripe, balance } = useWalletContext();
  const [activeTab, setActiveTab] = useState<"wallet" | "history">("wallet");
  const [walletAction, setWalletAction] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [withdrawalFee, setWithdrawalFee] = useState(0.05); // Default 5%

  // Header is controlled by expo-router layout

  useEffect(() => {
    loadTransactions();
    loadFee();
  }, [user]);

  const loadFee = async () => {
    const fee = await walletService.getWithdrawalFee();
    setWithdrawalFee(fee);
  };

  const loadTransactions = async () => {
    if (!user?.id) return;
    setTransactionsLoading(true);
    const data = await walletService.getTransactions(user.id);
    setTransactions(data);
    setTransactionsLoading(false);
  };

  const handleTopUp = async () => {
    if (!isStripeNativeAvailable) {
      Alert.alert("Development Mode", "Stripe is not available in Expo Go. Top up simulated.");
      return;
    }

    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount.");
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

    return (
      <>
        {transactions.map((tx, index) => {
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

          return (
            <View key={tx.id} style={[styles.txRow, index === transactions.length - 1 && { borderBottomWidth: 0 }]}>
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
      </>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButtonLeft}>
          <Text style={[styles.backButtonText, { color: theme.primary }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Wallet</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0} // Accounts for custom header
      >
        <View style={[styles.tabsContainer, { backgroundColor: isDark ? theme.surface : '#E5E5EA' }]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'wallet' && styles.activeTab, activeTab === 'wallet' && isDark && { backgroundColor: theme.background }]}
            onPress={() => setActiveTab('wallet')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'wallet' ? theme.primary : theme.textSecondary }]}>Add/Withdraw</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'history' && styles.activeTab, activeTab === 'history' && isDark && { backgroundColor: theme.background }]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'history' ? theme.primary : theme.textSecondary }]}>History</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Balance Card Always Visible */}
          <View style={[styles.balanceContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={styles.balanceLabel}>Total Balance</Text>
            <Text style={[styles.balanceAmount, { color: theme.text }]}>{formatCurrency(balance)}</Text>
          </View>

          {activeTab === 'wallet' ? (
            <>
              {/* Action Toggle */}
              <View style={[styles.actionToggle, { backgroundColor: isDark ? theme.surface : '#EEEFF1' }]}>
                <TouchableOpacity
                  style={[styles.actionButton, walletAction === 'deposit' && styles.actionActive, walletAction === 'deposit' && isDark && { backgroundColor: theme.background }]}
                  onPress={() => setWalletAction('deposit')}
                >
                  <Text style={[styles.actionText, { color: theme.text, fontWeight: walletAction === 'deposit' ? '600' : '400' }]}>Add Funds</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, walletAction === 'withdraw' && styles.actionActive, walletAction === 'withdraw' && isDark && { backgroundColor: theme.background }]}
                  onPress={() => setWalletAction('withdraw')}
                >
                  <Text style={[styles.actionText, { color: theme.text, fontWeight: walletAction === 'withdraw' ? '600' : '400' }]}>Withdraw</Text>
                </TouchableOpacity>
              </View>

              {walletAction === 'deposit' ? (
                /* Deposit Card */
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>Deposit</Text>
                    <Text style={styles.cardSubtitle}>Top up your virtual wallet</Text>
                  </View>

                  <View style={styles.amountGrid}>
                    {PREDEFINED_AMOUNTS.map(val => (
                      <TouchableOpacity
                        key={val}
                        style={[
                          styles.amountButton,
                          { backgroundColor: theme.surface, borderColor: amount === val.toString() ? theme.primary : theme.border },
                          amount === val.toString() && styles.selectedAmount,
                          amount === val.toString() && isDark && { backgroundColor: '#003A66' }
                        ]}
                        onPress={() => setAmount(val.toString())}
                      >
                        <Text style={[styles.amountText, { color: theme.text }, amount === val.toString() && styles.selectedText]}>${val}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="Custom Amount"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                  />

                  <TouchableOpacity style={styles.primaryButton} onPress={handleTopUp} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Add Funds</Text>}
                  </TouchableOpacity>
                </View>
              ) : (
                /* Withdraw Card - Stripe */
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>Withdraw</Text>
                    <Text style={styles.cardSubtitle}>Transfer funds to your bank account</Text>
                  </View>

                  <View style={styles.verticalPayoutContainer}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Amount to Withdraw</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                      value={amount}
                      onChangeText={setAmount}
                      placeholder="0.00"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="decimal-pad"
                    />

                    {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && (
                      <View style={[styles.receiptContainer, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
                        <Text style={[styles.receiptTitle, { color: theme.textSecondary }]}>TRANSACTION DETAILS</Text>

                        <View style={styles.receiptRow}>
                          <Text style={[styles.receiptLabel, { color: theme.text }]}>Withdrawal Amount</Text>
                          <Text style={[styles.receiptValue, { color: theme.text }]}>${parseFloat(amount).toFixed(2)}</Text>
                        </View>

                        <View style={styles.receiptRow}>
                          <Text style={[styles.receiptLabel, { color: theme.textSecondary }]}>Stripe Processing (1.75%)</Text>
                          <Text style={[styles.receiptValue, { color: theme.textSecondary }]}>-${(parseFloat(amount) * 0.0175).toFixed(2)}</Text>
                        </View>

                        <View style={styles.receiptRow}>
                          <Text style={[styles.receiptLabel, { color: theme.textSecondary }]}>
                            Platform Fee ({((withdrawalFee - 0.0175) * 100).toFixed(2)}%)
                          </Text>
                          <Text style={[styles.receiptValue, { color: theme.textSecondary }]}>-${(parseFloat(amount) * (withdrawalFee - 0.0175)).toFixed(2)}</Text>
                        </View>

                        <View style={[styles.receiptDivider, { backgroundColor: theme.border }]} />

                        <View style={styles.receiptRow}>
                          <Text style={[styles.receiptLabel, { color: theme.text, fontWeight: '600' }]}>Total Fees ({(withdrawalFee * 100).toFixed(2)}%)</Text>
                          <Text style={[styles.receiptValue, { color: theme.text, fontWeight: '600' }]}>-${(parseFloat(amount) * withdrawalFee).toFixed(2)}</Text>
                        </View>

                        <View style={[styles.receiptDivider, { backgroundColor: theme.border }]} />

                        <View style={styles.receiptRow}>
                          <Text style={[styles.receiptLabel, { color: theme.text, fontWeight: '700', fontSize: 16 }]}>Estimated Payout</Text>
                          <Text style={[styles.receiptValue, { color: '#34C759', fontWeight: '700', fontSize: 16 }]}>
                            ${(parseFloat(amount) * (1 - withdrawalFee)).toFixed(2)}
                          </Text>
                        </View>

                        <View style={styles.receiptFooter}>
                          <Text style={[styles.receiptNote, { color: theme.textSecondary }]}>
                            Funds typically arrive in 2-3 business days.
                          </Text>
                        </View>
                      </View>
                    )}

                    <TouchableOpacity style={styles.payoutButton} onPress={handleStripeWithdrawal} disabled={loading}>
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Confirm Withdrawal</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          ) : (
            <View style={[styles.historyList, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {renderTransactions()}
            </View>
          )}
        </ScrollView>


      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7"
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  headerButtonLeft: {
    position: 'absolute',
    left: 12,
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: "300",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "500",
    color: "#000",
  },
  content: {
    paddingVertical: 16,
  },
  balanceContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#C6C6C8',
    marginBottom: 24,
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
  card: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  cardHeader: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000'
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2
  },
  amountGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
  },
  amountButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E5EA'
  },
  selectedAmount: {
    backgroundColor: '#E7F3FF',
    borderColor: '#007AFF'
  },
  amountText: {
    fontWeight: '600',
    fontSize: 15,
    color: '#000'
  },
  selectedText: {
    color: '#007AFF'
  },
  input: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    fontSize: 17,
    color: '#000',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#C6C6C8',
    marginBottom: 16
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    padding: 12, // Thinner
    borderRadius: 12,
    alignItems: 'center'
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '500', // Elegant
    fontSize: 16
  },
  verticalPayoutContainer: {
    marginTop: 0
  },
  payoutButton: {
    backgroundColor: '#FF3B30',
    padding: 12, // Thinner
    borderRadius: 12,
    alignItems: 'center'
  },
  fieldLabel: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#E5E5EA',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 2,
    borderRadius: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 7,
  },
  activeTab: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1.5 },
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600'
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
    fontWeight: '600'
  },
  actionToggle: {
    flexDirection: 'row',
    padding: 2,
    backgroundColor: '#EEEFF1',
    borderRadius: 8,
    marginBottom: 24,
    marginHorizontal: 20
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 7
  },
  actionActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 1,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  receiptContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  receiptTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  receiptLabel: {
    fontSize: 14,
  },
  receiptValue: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  receiptDivider: {
    height: 1,
    marginVertical: 12,
  },
  receiptFooter: {
    marginTop: 8,
    alignItems: 'center',
  },
  receiptNote: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});
