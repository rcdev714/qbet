import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, SafeAreaView, StatusBar, ActivityIndicator, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useMarket } from "../hooks/useMarket";
import { betService } from "../services/bet.service";
import { useWalletContext } from "../contexts/WalletContext";
import { useTheme } from "../contexts/ThemeContext";
import { BottomNavBar } from "../components/BottomNavBar";
import { calculateImpliedOdds, calculatePotentialPayout, formatCurrency, formatProbability } from "../lib/parimutuel";
// Removed RootStackParamList import

export function MarketScreen() {
  const router = useRouter();
  const { id: marketId } = useLocalSearchParams<{ id: string }>();
  const { market, options, userBets, loading, refresh } = useMarket(marketId);
  const { balance, refresh: refreshWallet } = useWalletContext();
  const { theme, isDark } = useTheme();
  const [bettingAmount, setBettingAmount] = useState<string>("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlacingBet, setIsPlacingBet] = useState(false);

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.text} />
      </View>
    );
  }

  if (!market) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Market not found</Text>
      </View>
    );
  }

  const totalPool = options.reduce((sum, opt) => sum + Number(opt.total_pool), 0);
  const impliedOdds = calculateImpliedOdds(options);

  const handlePlaceBet = async () => {
    if (!selectedOption || !bettingAmount) {
      setError("Please enter a bet amount");
      return;
    }

    const amount = parseFloat(bettingAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid bet amount");
      return;
    }

    if (amount > balance) {
      setError("Insufficient balance");
      return;
    }

    setIsPlacingBet(true);
    setError(null);

    const { error: betError } = await betService.placeBet({
      marketId,
      optionId: selectedOption,
      amount,
    });

    setIsPlacingBet(false);

    if (betError) {
      const errorMessage = betError.message || "Failed to place bet. Please try again.";
      setError(errorMessage);
      Alert.alert("Bet Failed", errorMessage);
    } else {
      setBettingAmount("");
      setSelectedOption(null);
      setError(null);
      refreshWallet();
      refresh();
      Alert.alert("Success", "Bet placed successfully!");
    }
  };

  const getPotentialPayout = (optionId: string, amount: number) => {
    if (isNaN(amount) || amount <= 0) return null;
    const option = options.find((opt) => opt.id === optionId);
    if (!option) return null;
    return calculatePotentialPayout(amount, Number(option.total_pool), totalPool, 0.0795);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[
              styles.statusBadge,
              market.status === 'open' ? styles.statusOpen : styles.statusClosed
            ]}>
              {market.status.toUpperCase()}
            </Text>
            {market.closes_at && (
              <Text style={styles.headerDate}>
                Ends {new Date(market.closes_at).toLocaleDateString()}
              </Text>
            )}
          </View>
        </View>

        <View style={[styles.questionContainer, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <Text style={[styles.question, { color: theme.text }]}>{market.question}</Text>
          {market.description && (
            <Text style={[styles.description, { color: theme.textSecondary }]}>{market.description}</Text>
          )}
          <TouchableOpacity
            style={styles.poolContainer}
            onPress={() => router.push(`/bet/${marketId}` as any)}
            activeOpacity={0.7}
          >
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.poolLabel}>Pool: </Text>
                <Text style={[styles.poolValue, { color: theme.text }]}>{formatCurrency(totalPool)}</Text>
                <View style={[styles.arrow, { borderColor: theme.border }]} />
              </View>
              <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 4 }}>
                Fees apply. Click for distribution.
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {userBets.length > 0 && (
          <View style={styles.positionSection}>
            <Text style={styles.sectionTitle}>Your Positions</Text>
            {userBets.map((bet) => {
              const option = options.find(o => o.id === bet.option_id);
              const isResolved = market.status === 'resolved';
              const isWinner = isResolved && market.winning_option_id === bet.option_id;

              return (
                <View key={bet.id} style={[styles.positionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={styles.positionHeader}>
                    <Text style={[styles.positionLabel, { color: theme.text }]}>{option?.label}</Text>
                    <Text style={[
                      styles.positionStatus,
                      isResolved
                        ? (isWinner ? { color: '#34C759' } : { color: theme.textSecondary })
                        : { color: theme.primary }
                    ]}>
                      {isResolved ? (isWinner ? 'WON' : 'LOST') : 'PLACED'}
                    </Text>
                  </View>
                  <View style={styles.positionMeta}>
                    <Text style={styles.positionText}>Wagered: {formatCurrency(bet.amount)}</Text>
                    {isResolved ? (
                      <Text style={[styles.positionText, { fontWeight: '700', color: isWinner ? '#34C759' : theme.textSecondary }]}>
                        {isWinner ? `+${formatCurrency((bet.amount / Number(option?.total_pool || 1)) * (totalPool * (1 - 0.0795)))}` : '-$0.00'}
                      </Text>
                    ) : (
                      <Text style={styles.positionText}>
                        Share: {((bet.amount / Number(option?.total_pool || 1)) * 100).toFixed(1)}%
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.optionsContainer}>
          <Text style={styles.sectionTitle}>Pick an Option</Text>
          {options.map((option) => {
            const odds = impliedOdds.find((o) => o.optionId === option.id);
            const isSelected = selectedOption === option.id;
            const betAmount = bettingAmount ? parseFloat(bettingAmount) : 0;
            const potentialPayout = selectedOption && bettingAmount && !isNaN(betAmount) && betAmount > 0
              ? getPotentialPayout(option.id, betAmount)
              : null;

            const percent = totalPool > 0 ? (Number(option.total_pool) / totalPool) * 100 : 0;

            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionCard,
                  { backgroundColor: theme.surface, borderColor: isSelected ? theme.primary : theme.border },
                  isSelected && styles.optionSelected
                ]}
                onPress={() => setSelectedOption(option.id)}
                activeOpacity={0.8}
              >
                {/* Progress Bar Background */}
                <View style={[
                  styles.progressBarContainer,
                  {
                    width: `${percent}%`,
                    backgroundColor: theme.primary,
                    opacity: isSelected ? 0.15 : 0.08
                  }
                ]} />

                <View style={styles.optionHeader}>
                  <Text style={[styles.optionLabel, { color: theme.text }, isSelected && styles.optionLabelSelected]}>
                    {option.label}
                  </Text>
                  {odds && (
                    <View style={[styles.probabilityBadge, { backgroundColor: isDark ? theme.background : "#E5E5EA" }, isSelected && styles.probabilityBadgeSelected]}>
                      <Text style={[styles.probabilityText, { color: isSelected ? theme.primary : theme.textSecondary }]}>
                        {formatProbability(odds.probability)}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.optionMeta}>
                  <Text style={[styles.optionPoolText, { color: theme.textSecondary }]}>
                    Pool: {formatCurrency(Number(option.total_pool))}
                  </Text>
                  {percent > 0 && (
                    <Text style={[styles.percentText, { color: theme.textSecondary }]}>
                      {percent.toFixed(1)}%
                    </Text>
                  )}
                </View>

                {potentialPayout && isSelected && (
                  <View style={[styles.payoutContainer, { borderTopColor: theme.border }]}>
                    <View style={styles.payoutRow}>
                      <Text style={styles.payoutLabel}>Potential Return</Text>
                      <Text style={[styles.payoutValue, { color: theme.text }]}>{formatCurrency(potentialPayout.potentialPayout)}</Text>
                    </View>
                    <View style={styles.payoutRow}>
                      <Text style={styles.payoutLabel}>Est. Profit</Text>
                      <Text style={styles.profitValue}>+{formatCurrency(potentialPayout.potentialProfit)}</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {selectedOption && (
        <View style={[styles.bettingBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <View style={styles.balanceContainer}>
            <Text style={styles.balanceLabel}>Funds Available</Text>
            <Text style={[styles.balanceValue, { color: theme.text }]}>{formatCurrency(balance)}</Text>
          </View>

          <View style={styles.betInputContainer}>
            <TextInput
              style={[styles.betInput, { backgroundColor: isDark ? theme.background : "#F2F2F7", color: theme.text }]}
              placeholder="$0"
              placeholderTextColor={theme.textSecondary}
              value={bettingAmount}
              onChangeText={(text) => {
                setBettingAmount(text);
                setError(null);
              }}
              keyboardType="numeric"
              autoFocus={false}
            />
            {(() => {
              const amount = bettingAmount ? parseFloat(bettingAmount) : 0;
              const isDisabled = !bettingAmount || isNaN(amount) || amount <= 0 || amount > balance || isPlacingBet;

              return (
                <TouchableOpacity
                  style={[styles.placeBetButton, isDisabled && styles.placeBetButtonDisabled]}
                  onPress={handlePlaceBet}
                  disabled={isDisabled}
                >
                  <Text style={styles.placeBetButtonText}>
                    {isPlacingBet ? "..." : "Confirm"}
                  </Text>
                </TouchableOpacity>
              );
            })()}
          </View>
          {error && <Text style={styles.footerError}>{error}</Text>}
        </View>
      )}
      <BottomNavBar router={router} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7", // iOS background
    paddingBottom: Platform.OS === "ios" ? 80 : 70,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 40 : 16,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#C6C6C8",
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  backButtonText: {
    fontSize: 24,
    color: "#007AFF",
    fontWeight: "600",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
    gap: 12,
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  statusOpen: { color: "#34C759" }, // Green for open in header
  statusClosed: { color: "#8E8E93" },
  headerDate: {
    fontSize: 13,
    color: "#8E8E93",
  },
  questionContainer: {
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#C6C6C8",
  },
  question: {
    fontSize: 24,
    fontWeight: "800",
    color: "#000",
    marginBottom: 8,
    letterSpacing: -1,
    lineHeight: 30,
  },
  description: {
    fontSize: 15,
    color: "#8E8E93",
    marginBottom: 20,
    lineHeight: 22,
  },
  poolContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  poolLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  poolValue: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000",
  },
  arrow: {
    width: 6,
    height: 6,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: "#C7C7CC",
    transform: [{ rotate: "45deg" }],
    marginLeft: 8,
  },
  optionsContainer: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  positionSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  optionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#C6C6C8",
    overflow: "hidden",
    position: "relative",
  },
  progressBarContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: -1,
  },
  optionSelected: {
    borderColor: "#007AFF",
    borderWidth: 1.5,
  },
  optionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000",
  },
  optionLabelSelected: {
    color: "#007AFF",
  },
  probabilityBadge: {
    backgroundColor: "#E5E5EA",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  probabilityBadgeSelected: {
    backgroundColor: "#E7F3FF",
  },
  probabilityText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8E8E93",
  },
  probabilityTextSelected: {
    color: "#007AFF",
  },
  optionMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  percentText: {
    fontSize: 13,
    fontWeight: "500",
  },
  optionPoolText: {
    fontSize: 13,
    color: "#8E8E93",
  },
  optionPoolTextSelected: {
    color: "#8E8E93",
  },
  payoutContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#C6C6C8",
  },
  payoutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  payoutLabel: {
    fontSize: 12,
    color: "#8E8E93",
  },
  payoutValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#000",
  },
  profitValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#34C759",
  },
  bettingBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#C6C6C8",
  },
  balanceContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 13,
    color: "#8E8E93",
  },
  balanceValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#000",
  },
  betInputContainer: {
    flexDirection: "row",
    gap: 12,
  },
  betInput: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 17,
    fontWeight: "500",
    color: "#000",
    height: 50,
  },
  placeBetButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    borderRadius: 10,
    justifyContent: "center",
    height: 50,
  },
  placeBetButtonDisabled: {
    backgroundColor: "#E5E5EA",
  },
  placeBetButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  footerError: {
    color: "#FF3B30",
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 16,
  },
  positionCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#C6C6C8',
    marginBottom: 12
  },
  positionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  positionLabel: { fontSize: 16, fontWeight: '600', color: '#000' },
  positionStatus: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  positionMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  positionText: { fontSize: 13, color: '#8E8E93' },
});

