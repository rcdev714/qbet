import { Brand } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Dimensions, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { AnyMarketLoader } from "../components/AnyMarketLoader";
import { GlobalHeader } from "../components/GlobalHeader";
import { MarketChatTab } from "../components/MarketChatTab";
import { MarketProbabilityChart } from "../components/MarketProbabilityChart";
import { SEO } from "../components/SEO";
import { SocialShareMarketCard } from "../components/SocialShareMarketCard";
import { useAppLocale } from "../contexts/LocaleContext";
import { useTheme } from "../contexts/ThemeContext";
import { useWalletContext } from "../contexts/WalletContext";
import { useMarket } from "../hooks/useMarket";
import { usePremiumNavigation } from "../hooks/usePremiumNavigation";
import { scanMarketTextForSports } from "../lib/compliance/sports-content";
import { getBinaryOptions, isBinaryMarket } from "../lib/market-utils";
import { calculateYesNoPayout, formatCurrency } from "../lib/parimutuel";
import { getParamString } from "../lib/route-params";
import { betService } from "../services/bet.service";
import { shareService } from "../services/share.service";
import type { MarketWithStats } from "../types/market";


// Responsive layout constants
const { width: windowWidth } = Dimensions.get('window');
const MAX_WEB_WIDTH = 600;
// We subtract 32 for padding (16 left + 16 right)
const contentWidth = Platform.OS === 'web' ? Math.min(windowWidth, MAX_WEB_WIDTH) - 32 : windowWidth - 32;

export function MarketScreen() {
  const router = useRouter();
  const { navigate } = usePremiumNavigation();
  const params = useLocalSearchParams<{ id: string; optionId?: string; previewAmount?: string; side?: string; tab?: string }>();
  const marketId = getParamString(params.id) ?? null;
  const { market, options, userBets, loading, refresh } = useMarket(marketId);
  const { balance, isPlayMode, refresh: refreshWallet, notifyBetPlaced } = useWalletContext();
  const { theme, isDark } = useTheme();
  const { locale, residence } = useAppLocale();
  const { t } = useTranslation("compliance");
  
  // Initialize with optionId and previewAmount if present (ensure they're strings, useLocalSearchParams can return arrays)
  const initialOption = getParamString(params.optionId);
  const initialAmount = getParamString(params.previewAmount);
  const initialSide = getParamString(params.side);
  const initialTab = getParamString(params.tab);
  
  const [bettingAmount, setBettingAmount] = useState<string>(initialAmount || "");
  const [selectedOption, setSelectedOption] = useState<string | null>(initialOption || null);
  const [selectedSide, setSelectedSide] = useState<"yes" | "no" | null>(
    initialSide === "yes" || initialSide === "no" ? initialSide : null
  );
  const [error, setError] = useState<string | null>(null);
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [activeTab, setActiveTab] = useState<'predict' | 'chart' | 'chat'>(
    (initialTab === 'chat' || initialTab === 'chart') ? initialTab : 'predict'
  );
  const [oneTapBetEnabled, setOneTapBetEnabled] = useState(false);
  const [showOneTapHint, setShowOneTapHint] = useState(false);
  const [showShareOverlay, setShowShareOverlay] = useState(false);

  const handleShare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowShareOverlay(true);
  };

  const triggerSystemShare = async () => {
    if (market) {
      await shareService.shareMarket(market);
    }
    setShowShareOverlay(false);
  };

  const marketStats = React.useMemo(() => {
    if (!market || !options) return null;

    const totalPool = options.reduce((sum, opt) => {
      const yesPool = Number(opt.yes_pool ?? opt.total_pool ?? 0);
      const noPool = Number(opt.no_pool ?? 0);
      return sum + yesPool + noPool;
    }, 0);

    const optionStats = options.map(opt => {
      const yesPool = Number(opt.yes_pool ?? opt.total_pool ?? 0);
      const noPool = Number(opt.no_pool ?? 0);
      const optionTotal = yesPool + noPool;
      
      const percent = totalPool > 0 ? (optionTotal / totalPool) * 100 : 0;
      
      const numOptions = options.length;
      let yesPrice = totalPool > 0 ? optionTotal / totalPool : (1 / numOptions);
      let noPrice = 1 - yesPrice;
      
      // Clamp
      if (yesPrice < 0.01) { yesPrice = 0.01; noPrice = 0.99; }
      else if (yesPrice > 0.99) { yesPrice = 0.99; noPrice = 0.01; }

      return {
        optionId: opt.id,
        label: opt.label || 'Option',
        yesPool,
        noPool,
        yesPrice,
        noPrice,
        percentage: percent
      };
    });

    return {
      ...market,
      totalPool,
      betCount: 0,
      optionStats,
      recentBets: []
    } as MarketWithStats;
  }, [market, options]);

  const isEcSportsBlocked = React.useMemo(() => {
    if (residence?.jurisdiction !== "EC" || !market) return false;
    const category = String(market.market_category || market.category || "");
    return scanMarketTextForSports({
      question: market.question,
      description: market.description,
      resolutionSource: market.resolution_source,
      optionLabels: options.map((option) => option.label),
      category,
    }).blocked;
  }, [market, options, residence?.jurisdiction]);

  if (loading) {
    return <AnyMarketLoader message="Preparing the market..." />;
  }

  if (!market) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background, flex: 1 }]}>
        <Text style={[styles.errorText, { color: theme.text }]}>
          This market could not be found. Go back and choose another prediction.
        </Text>
        <TouchableOpacity style={{ marginTop: 16 }} onPress={() => router.back()}>
          <Text style={{ color: theme.primary, fontWeight: "600" }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const resolvedMarketId = market.id;

  const totalPool = options.reduce((sum, opt) => {
    const yesPool = Number(opt.yes_pool ?? opt.total_pool ?? 0);
    const noPool = Number(opt.no_pool ?? 0);
    return sum + yesPool + noPool;
  }, 0);

  const handlePlaceBet = async () => {
    if (isEcSportsBlocked && !isPlayMode) {
      setError(t("sportsMarketBlockedBody"));
      return;
    }

    if (!selectedOption || !selectedSide) {
      setError("Choose an outcome before placing your bet.");
      return;
    }

    if (!bettingAmount) {
      setError("Enter an amount before placing your bet.");
      return;
    }

    const amount = parseFloat(bettingAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Enter a valid amount greater than 0.");
      return;
    }

    if (amount > balance) {
      setError("Your balance is too low. Add funds or switch to Practice mode.");
      return;
    }

    setIsPlacingBet(true);
    setError(null);

    const { error: betError } = await betService.placeBet({
      marketId: resolvedMarketId,
      optionId: selectedOption,
      amount,
      side: selectedSide,
      isPlayMode,
    });

    setIsPlacingBet(false);

    if (betError) {
      const errorMessage = betError.message || "We couldn't place your bet. Check your connection and try again.";
      setError(errorMessage);
      Alert.alert("Bet wasn't placed", errorMessage);
    } else {
      setBettingAmount("");
      setSelectedOption(null);
      setSelectedSide(null);
      setError(null);
      refreshWallet();
      refresh();
      notifyBetPlaced();
      Alert.alert("Bet placed", "Your prediction is in. Prices and balance are updating now.");
    }
  };

  const getPotentialPayout = (optionId: string, side: "yes" | "no", amount: number) => {
    if (isNaN(amount) || amount <= 0) return null;
    const option = options.find((opt) => opt.id === optionId);
    if (!option) return null;
    const yesPool = Number(option.yes_pool ?? option.total_pool ?? 0);
    const noPool = Number(option.no_pool ?? 0);
    const optionTotal = yesPool + noPool;
    
    // YES price = option's probability (share of total market pool)
    // NO price = complement (1 - yesPrice)
    const numOptions = options.length;
    let yesPrice = totalPool > 0 ? optionTotal / totalPool : (1 / numOptions);
    let noPrice = 1 - yesPrice;
    
    // Clamp to avoid 0¢ or 100¢ extremes
    if (yesPrice < 0.01) { yesPrice = 0.01; noPrice = 0.99; }
    else if (yesPrice > 0.99) { yesPrice = 0.99; noPrice = 0.01; }
    
    const sidePrice = side === "yes" ? yesPrice : noPrice;
    return calculateYesNoPayout(amount, sidePrice, 0.0795);
  };

  const leadingOptions = marketStats?.optionStats
    ?.slice()
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 2)
    .map((option) => `${option.label} ${Math.round(option.percentage)}%`)
    .join(" · ");
  const marketPreviewDescription = [
    market.description || `Predict how this market resolves with friends on AnyMarket.`,
    leadingOptions ? `Current predictions: ${leadingOptions}.` : null,
    totalPool > 0 ? `$${totalPool.toLocaleString()} predicted so far.` : null,
  ].filter(Boolean).join(" ");

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SEO 
        title={`Predict: ${market.question}`}
        description={marketPreviewDescription}
        image={market.image_url || undefined}
        imageAlt={`AnyMarket prediction market: ${market.question}`}
        url={`/market/${resolvedMarketId}`}
        locale={locale === "es" ? "es_ES" : "en_US"}
      />
      
      {/* Background Image Header */}
      <View style={styles.headerImageContainer}>
        {market.image_url ? (
          <Image
            source={{ uri: market.image_url }}
            style={styles.headerImage}
            contentFit="cover"
            transition={300}
          />
        ) : (
          <View style={[styles.headerImage, { backgroundColor: isDark ? '#1C1C1E' : '#E5E5EA' }]} />
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'transparent', theme.background]}
          locations={[0, 0.4, 1]}
          style={styles.headerGradient}
        />
      </View>

      <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* Global Header with Mode Toggle */}
        <GlobalHeader
          transparent
          ignoreTopInset
          left={
            <TouchableOpacity 
              onPress={() => router.back()} 
              style={[
                styles.backButton, 
                { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 }
              ]}
            >
              <Text style={[styles.backButtonText, { color: '#fff' }]}>←</Text>
            </TouchableOpacity>
          }
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity 
                onPress={handleShare} 
                style={[
                    styles.iconButton, 
                    { backgroundColor: 'rgba(0,0,0,0.5)', borderColor: 'rgba(255,255,255,0.2)' }
                ]}
              >
                 <Ionicons name="share-outline" size={20} color="#fff" />
              </TouchableOpacity>
              <View style={styles.headerContent}>
                <Text style={[
                  styles.statusBadge,
                  market.status === 'open' ? styles.statusOpen : styles.statusClosed,
                   { 
                     backgroundColor: 'rgba(0,0,0,0.5)', 
                     paddingHorizontal: 8, 
                     paddingVertical: 4, 
                     borderRadius: 12,
                     overflow: 'hidden',
                     color: '#fff'
                   }
                ]}>
                  {(market.status || 'open').toUpperCase()}
                </Text>
              </View>
            </View>
          }
        />

        <View style={[
          styles.questionContainer, 
          { 
            backgroundColor: theme.surface, 
            borderBottomColor: theme.border,
            marginTop: 140 
          }
        ]}>
          <Text style={[styles.question, { color: theme.text }]}>{market.question}</Text>
          {market.description && (
            <Text style={[styles.description, { color: theme.textSecondary }]}>{market.description}</Text>
          )}
          <TouchableOpacity
            style={styles.poolContainer}
            onPress={() => navigate(`/bet/${resolvedMarketId}`, { message: "Loading market activity..." })}
            activeOpacity={0.7}
          >
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.poolLabel}>Pool: </Text>
                <Text style={[styles.poolValue, { color: theme.text }]}>{formatCurrency(totalPool)}</Text>
              </View>
              <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 4 }}>
                Fees apply. Click for distribution.
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={[styles.tabContainer, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'predict' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab('predict')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'predict' ? theme.primary : theme.textSecondary }]}>Predict</Text>
          </TouchableOpacity>
          {market.is_public && (
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'chat' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab('chat')}
            >
              <Text style={[styles.tabText, { color: activeTab === 'chat' ? theme.primary : theme.textSecondary }]}>Live Chat</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'chart' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab('chart')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'chart' ? theme.primary : theme.textSecondary }]}>Chart</Text>
          </TouchableOpacity>
        </View>

        {/* Chat tab renders directly (has its own FlatList) - avoids VirtualizedList nesting */}
        {activeTab === 'chat' && (
          <MarketChatTab marketId={resolvedMarketId} />
        )}

        {/* Other tabs render in ScrollView */}
        {activeTab !== 'chat' && (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {isEcSportsBlocked && (
              <View style={[styles.sportsBlockBanner, { backgroundColor: "rgba(255, 59, 48, 0.12)", borderColor: theme.error }]}>
                <Text style={[styles.sportsBlockTitle, { color: theme.error }]}>{t("sportsMarketBlockedTitle")}</Text>
                <Text style={[styles.sportsBlockBody, { color: theme.textSecondary }]}>{t("sportsMarketBlockedBody")}</Text>
                {isPlayMode ? (
                  <Text style={[styles.sportsBlockNote, { color: theme.textSecondary }]}>{t("sportsMarketPracticeNote")}</Text>
                ) : null}
              </View>
            )}
            {activeTab === 'predict' && (
              <View style={styles.optionsContainer}>
                <View style={[styles.beginnerGuideCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={[styles.modePill, { backgroundColor: isPlayMode ? theme.primarySoft : "rgba(52, 199, 89, 0.16)" }]}>
                    <Text style={[styles.modePillText, { color: isPlayMode ? theme.primary : theme.success }]}>
                      {isPlayMode ? "Practice mode" : "Live mode"}
                    </Text>
                  </View>
                  <Text style={[styles.guideTitle, { color: theme.text }]}>Place your first prediction in 3 steps</Text>
                  <Text style={[styles.guideText, { color: theme.textSecondary }]}>
                    Choose an outcome, pick an amount, then review the possible payout before confirming.
                  </Text>
                </View>

                <Text style={styles.sectionTitle}>1. Choose an outcome</Text>
                
                {/* Binary Market UI - Simple Yes/No buttons */}
                {isBinaryMarket(market, options) && (() => {
                  const binary = getBinaryOptions(options);
                  if (!binary) return null;
                  
                  const { yesOption, noOption } = binary;
                  const yesPool = Number(yesOption.yes_pool ?? yesOption.total_pool ?? 0) + Number(yesOption.no_pool ?? 0);
                  const noPool = Number(noOption.yes_pool ?? noOption.total_pool ?? 0) + Number(noOption.no_pool ?? 0);
                  
                  let yesPrice = totalPool > 0 ? yesPool / totalPool : 0.5;
                  let noPrice = totalPool > 0 ? noPool / totalPool : 0.5;
                  if (yesPrice < 0.01) { yesPrice = 0.01; noPrice = 0.99; }
                  else if (yesPrice > 0.99) { yesPrice = 0.99; noPrice = 0.01; }
                  
                  const yesCents = Math.round(yesPrice * 100);
                  const noCents = Math.round(noPrice * 100);
                  const yesPercent = totalPool > 0 ? (yesPool / totalPool) * 100 : 50;
                  const noPercent = totalPool > 0 ? (noPool / totalPool) * 100 : 50;
                  
                  const isYesSelected = selectedOption === yesOption.id && selectedSide === "yes";
                  const isNoSelected = selectedOption === noOption.id && selectedSide === "yes";
                  const betAmount = bettingAmount ? parseFloat(bettingAmount) : 0;
                  const potentialPayout = selectedOption && selectedSide && bettingAmount && !isNaN(betAmount) && betAmount > 0
                    ? getPotentialPayout(selectedOption, selectedSide, betAmount)
                    : null;
                  
                  return (
                    <>
                      {/* Yes Option */}
                      <TouchableOpacity
                        style={[
                          styles.binaryOptionCard,
                          { 
                            backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.9)',
                            borderColor: isYesSelected ? theme.primary : (isDark ? 'rgba(212, 175, 55, 0.3)' : `${theme.primary}33`)
                          },
                          isYesSelected && styles.optionSelected
                        ]}
                        onPress={() => {
                          setSelectedOption(yesOption.id);
                          setSelectedSide("yes");
                          Haptics.selectionAsync();
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={[
                          styles.progressBarContainer,
                          { width: `${yesPercent}%`, backgroundColor: theme.primary, opacity: isDark ? 0.3 : 0.1 }
                        ]} />
                        <View style={styles.binaryOptionContent}>
                          <Text style={[styles.binaryOptionLabel, { color: isYesSelected ? (isDark ? theme.onPrimary : theme.primary) : theme.text, fontWeight: '400' }]}>
                            Yes
                          </Text>
                          <Text style={[styles.binaryOptionPrice, { color: isYesSelected ? (isDark ? theme.onPrimary : theme.primary) : theme.text, fontWeight: '600' }]}>
                            {yesCents}¢
                          </Text>
                          <Text style={[styles.binaryOptionPercent, { color: isYesSelected ? (isDark ? theme.onPrimary : theme.primary) : theme.textSecondary, fontWeight: '400' }]}>
                            {Math.round(yesPercent)}%
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* No Option */}
                      <TouchableOpacity
                        style={[
                          styles.binaryOptionCard,
                          { 
                            backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.9)',
                            borderColor: isNoSelected ? theme.error : (isDark ? 'rgba(212, 175, 55, 0.3)' : `${theme.primary}33`)
                          },
                          isNoSelected && styles.optionSelected
                        ]}
                        onPress={() => {
                          setSelectedOption(noOption.id);
                          setSelectedSide("yes");
                          Haptics.selectionAsync();
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={[
                          styles.progressBarContainer,
                          { width: `${noPercent}%`, backgroundColor: theme.error, opacity: 0.3 }
                        ]} />
                        <View style={styles.binaryOptionContent}>
                          <Text style={[styles.binaryOptionLabel, { color: isNoSelected ? theme.error : theme.text }]}>
                            No
                          </Text>
                          <Text style={[styles.binaryOptionPrice, { color: theme.error }]}>
                            {noCents}¢
                          </Text>
                          <Text style={[styles.binaryOptionPercent, { color: isNoSelected ? theme.error : theme.textSecondary }]}>
                            {Math.round(noPercent)}%
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* Payout Preview for Binary */}
                      {potentialPayout && (isYesSelected || isNoSelected) && (
                        <View style={[styles.payoutContainerStandalone, { backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.9)', borderColor: theme.border }]}>
                          <View style={styles.payoutRow}>
                            <Text style={styles.payoutLabel}>Your Bet</Text>
                            <Text style={[styles.payoutValue, { color: theme.text }]}>{formatCurrency(potentialPayout.userBet)}</Text>
                          </View>
                          <View style={styles.payoutRow}>
                            <Text style={styles.payoutLabel}>If You Win, You Get Back</Text>
                            <Text style={[styles.payoutValue, { color: theme.text }]}>{formatCurrency(potentialPayout.netPayout)}</Text>
                          </View>
                          <View style={[styles.payoutRow, { marginTop: 4, paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                            <Text style={[styles.payoutLabel, { fontWeight: '600' }]}>Net Profit</Text>
                            <Text style={[styles.profitValue, { color: theme.success }]}>+{formatCurrency(potentialPayout.potentialProfit)}</Text>
                          </View>
                          <Text style={styles.payoutNote}>
                            After fee: {(1 - 0.0795) * 100}% payout
                          </Text>
                        </View>
                      )}
                    </>
                  );
                })()}

                {/* Multi-option Market UI - Each option has YES/NO buttons */}
                {!isBinaryMarket(market, options) && [...options]
                  .sort((a, b) => {
                    const aTotal = Number(a.yes_pool ?? a.total_pool ?? 0) + Number(a.no_pool ?? 0);
                    const bTotal = Number(b.yes_pool ?? b.total_pool ?? 0) + Number(b.no_pool ?? 0);
                    return bTotal - aTotal;
                  })
                  .map((option, index) => {
                  const yesPool = Number(option.yes_pool ?? option.total_pool ?? 0);
                  const noPool = Number(option.no_pool ?? 0);
                  const optionTotal = yesPool + noPool;
                  
                  // YES price = option's probability (share of total market pool)
                  // NO price = complement
                  const numOptions = options.length;
                  let yesPrice = totalPool > 0 ? optionTotal / totalPool : (1 / numOptions);
                  let noPrice = 1 - yesPrice;
                  if (yesPrice < 0.01) { yesPrice = 0.01; noPrice = 0.99; }
                  else if (yesPrice > 0.99) { yesPrice = 0.99; noPrice = 0.01; }
                  const yesCents = Math.round(yesPrice * 100);
                  const noCents = Math.round(noPrice * 100);
                  const isYesSelected = selectedOption === option.id && selectedSide === "yes";
                  const isNoSelected = selectedOption === option.id && selectedSide === "no";
                  const betAmount = bettingAmount ? parseFloat(bettingAmount) : 0;
                  const potentialPayout = selectedOption && selectedSide && bettingAmount && !isNaN(betAmount) && betAmount > 0
                    ? getPotentialPayout(option.id, selectedSide, betAmount)
                    : null;

                  // Percentage = option's share of total market pool
                  const percent = totalPool > 0 ? (optionTotal / totalPool) * 100 : 0;
                  const accentColor = theme.primary;
                  const isSelected = isYesSelected || isNoSelected;

                  return (
                    <View
                      key={option.id}
                      style={[
                        styles.optionCard,
                        { 
                          backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : '#ffffff',
                          borderColor: isSelected ? accentColor : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)')
                        },
                        isSelected && styles.optionSelected
                      ]}
                    >
                      {/* Percentage fill background - transparent blue for all */}
                      <View style={[
                        styles.progressBarContainer,
                        {
                          width: `${percent}%`,
                          backgroundColor: accentColor,
                          opacity: 0.15
                        }
                      ]} />

                      <View style={styles.optionHeader}>
                        <View style={styles.optionLeft}>
                          <View style={[styles.optionDot, { backgroundColor: isSelected ? accentColor : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)') }]} />
                          <Text style={[styles.optionLabel, { color: theme.text, fontWeight: isSelected ? '600' : '400' }, isSelected && { color: isDark ? theme.onPrimary : theme.primary }]}>
                            {option.label}
                          </Text>
                        </View>
                        <Text style={[styles.optionPercentText, { color: isSelected ? (isDark ? theme.onPrimary : theme.primary) : theme.textSecondary, fontWeight: isSelected ? '600' : '400' }]}>
                          {Math.round(percent)}%
                        </Text>
                      </View>

                      <View style={styles.binaryButtons}>
                        <TouchableOpacity
                          style={[
                            styles.binaryButton,
                            {
                              backgroundColor: isYesSelected 
                                ? (isDark ? 'rgba(1, 22, 39, 0.8)' : theme.primarySoft)
                                : (isDark ? 'rgba(255,255,255,0.04)' : `${theme.primary}0D`),
                              borderColor: isYesSelected ? theme.primary : (isDark ? 'rgba(255,255,255,0.08)' : theme.primary),
                              borderWidth: isYesSelected ? 2 : 1,
                            },
                          ]}
                          onPress={() => {
                            setSelectedOption(option.id);
                            setSelectedSide("yes");
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.binaryButtonLabel, { color: isDark ? theme.onPrimary : theme.primary }]}>YES {yesCents}¢</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.binaryButton,
                            {
                              backgroundColor: isNoSelected 
                                ? (isDark ? 'rgba(255,59,48,0.35)' : '#FFC2C7')
                                : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,59,48,0.05)'),
                              borderColor: isNoSelected ? theme.error : (isDark ? 'rgba(255,255,255,0.08)' : theme.error),
                              borderWidth: isNoSelected ? 2 : 1,
                            },
                          ]}
                          onPress={() => {
                            setSelectedOption(option.id);
                            setSelectedSide("no");
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.binaryButtonLabel, { color: theme.error }]}>NO {noCents}¢</Text>
                        </TouchableOpacity>
                      </View>

                      {potentialPayout && (isYesSelected || isNoSelected) && (
                        <View style={[styles.payoutContainer, { borderTopColor: theme.border }]}>
                          <View style={styles.payoutRow}>
                            <Text style={styles.payoutLabel}>Your Bet</Text>
                            <Text style={[styles.payoutValue, { color: theme.text }]}>{formatCurrency(potentialPayout.userBet)}</Text>
                          </View>
                          <View style={styles.payoutRow}>
                            <Text style={styles.payoutLabel}>If You Win, You Get Back</Text>
                            <Text style={[styles.payoutValue, { color: theme.text }]}>{formatCurrency(potentialPayout.netPayout)}</Text>
                          </View>
                          <View style={[styles.payoutRow, { marginTop: 4, paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                            <Text style={[styles.payoutLabel, { fontWeight: '600' }]}>Net Profit</Text>
                            <Text style={[styles.profitValue, { color: theme.success }]}>+{formatCurrency(potentialPayout.potentialProfit)}</Text>
                          </View>
                          <Text style={styles.payoutNote}>
                            After fee: {(1 - 0.0795) * 100}% payout
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
            
            {activeTab === 'chart' && (
               <View style={styles.positionSection}>
                 <View style={styles.chartContainer}>
                  <MarketProbabilityChart
                    marketId={resolvedMarketId}
                    options={options}
                    height={300}
                    showLegend={true}
                    width={contentWidth}
                  />
                </View>
               </View>
            )}
          </ScrollView>
        )}

        {selectedOption && selectedSide && (
          <View style={[styles.bettingBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            <View style={styles.guidedBetHeader}>
              <View>
                <Text style={[styles.guidedStepLabel, { color: theme.textSecondary }]}>2. Choose amount</Text>
                <Text style={[styles.guidedStepTitle, { color: theme.text }]}>
                  {isPlayMode ? "Practice bet" : "Live bet"}
                </Text>
              </View>
              <View style={[styles.reviewBadge, { backgroundColor: isPlayMode ? theme.primarySoft : "rgba(52, 199, 89, 0.16)" }]}>
                <Text style={[styles.reviewBadgeText, { color: isPlayMode ? theme.primary : theme.success }]}>
                  Review before confirm
                </Text>
              </View>
            </View>
            <View style={styles.balanceRow}>
              <View style={styles.balanceContainer}>
                <Text style={styles.balanceLabel}>Funds Available</Text>
                <Text style={[styles.balanceValue, { color: theme.text }]}>{formatCurrency(balance)}</Text>
              </View>

              <View style={styles.oneTapToggleRow}>
                <TouchableOpacity 
                  onPress={() => setShowOneTapHint(!showOneTapHint)}
                  style={styles.helpIcon}
                >
                  <Ionicons name="help-circle-outline" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
                <Text style={[styles.oneTapLabel, { color: theme.textSecondary }]}>Advanced one-tap</Text>
                <Switch
                  value={oneTapBetEnabled}
                  onValueChange={setOneTapBetEnabled}
                  ios_backgroundColor={isDark ? "#333" : "#E5E5EA"}
                  trackColor={{ false: isDark ? "#333" : "#E5E5EA", true: theme.primary }}
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
              </View>
            </View>

            {showOneTapHint && (
              <View style={[styles.hintContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,122,255,0.05)' }]}>
                <Text style={[styles.hintText, { color: theme.textSecondary }]}>
                  Advanced mode places the bet as soon as you tap an amount.
                </Text>
              </View>
            )}

            <View style={styles.quickBetContainer}>
                {[0.10, 0.50, 1.00, 5.00].map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    style={[styles.quickBetChip, { backgroundColor: isDark ? '#1C1C1E' : '#E5E5EA' }]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      // Set amount for UI responsiveness
                      setBettingAmount(amt.toFixed(2));
                      setError(null);
                      
                      // Auto-place if valid
                      if (oneTapBetEnabled && selectedOption && selectedSide && !isPlacingBet && amt <= balance) {
                          // We need to pass the amount directly since state update might be slow
                          const placeAutoBet = async () => {
                              setIsPlacingBet(true);
                              setError(null);
                              
                              const { error: betError } = await betService.placeBet({
                                marketId: resolvedMarketId,
                                optionId: selectedOption,
                                amount: amt,
                                side: selectedSide,
                                isPlayMode,
                              });
                          
                              setIsPlacingBet(false);
                          
                              if (betError) {
                                const errorMessage = betError.message || "We couldn't place your one-tap bet. Try again.";
                                setError(errorMessage);
                                Alert.alert("Bet wasn't placed", errorMessage);
                              } else {
                                setBettingAmount("");
                                setSelectedOption(null);
                                setSelectedSide(null);
                                // Success Feedback
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                Alert.alert("Bet placed", `Placed a $${amt.toFixed(2)} bet. Prices and balance are updating now.`);
                                refreshWallet();
                                refresh();
                                notifyBetPlaced();
                              }
                          };
                          placeAutoBet();
                      } else if (!selectedOption || !selectedSide) {
                          setError("Choose YES or NO before using one-tap amounts.");
                      }
                    }}
                  >
                    <Text style={[styles.quickBetText, { color: theme.text }]}>${amt.toFixed(2)}</Text>
                  </TouchableOpacity>
                ))}
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
                const isDisabled =
                  !bettingAmount ||
                  isNaN(amount) ||
                  amount <= 0 ||
                  amount > balance ||
                  isPlacingBet ||
                  (isEcSportsBlocked && !isPlayMode);

                return (
                  <TouchableOpacity
                    style={[styles.placeBetButton, isDisabled && styles.placeBetButtonDisabled, { backgroundColor: theme.primary, borderColor: theme.primary, borderWidth: 1 }]}
                    onPress={handlePlaceBet}
                    disabled={isDisabled}
                  >
                    <Text style={[styles.placeBetButtonText, { color: theme.onPrimary }]}>
                      {isPlacingBet ? `Placing ${isPlayMode ? "practice" : "live"} bet…` : `Place ${isPlayMode ? "practice" : "live"} bet`}
                    </Text>
                  </TouchableOpacity>
                );
              })()}
            </View>
            {error && <Text style={styles.footerError}>{error}</Text>}
          </View>
        )}
      </KeyboardAvoidingView>

      {showShareOverlay && market && (
        <SocialShareMarketCard 
          market={market} 
          stats={marketStats}
          onClose={() => setShowShareOverlay(false)}
          onShare={triggerSystemShare}
        />
      )}
      </SafeAreaView>
      <StatusBar barStyle="light-content" />
    </View>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7", // iOS background
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
    color: Brand.primary,
    fontWeight: "400",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
    gap: 12,
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  statusOpen: { color: Brand.success },
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
    fontWeight: "600",
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
    fontWeight: "400",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  poolValue: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000",
  },
  chartContainer: {
    marginBottom: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 16,
    paddingVertical: 16,
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
  beginnerGuideCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
  },
  sportsBlockBanner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 6,
    marginBottom: 12,
  },
  sportsBlockTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  sportsBlockBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  sportsBlockNote: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  modePill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  modePillText: {
    fontSize: 12,
    fontWeight: "600",
  },
  guideTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 6,
  },
  guideText: {
    fontSize: 14,
    lineHeight: 20,
  },
  positionSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "400",
    color: "#8E8E93",
    textTransform: "uppercase",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  optionCard: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 1,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  progressBarContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
  },
  optionSelected: {
    borderWidth: 2,
  },
  binaryOptionCard: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 10,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  binaryOptionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  binaryOptionLabel: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
  binaryOptionPrice: {
    fontSize: 16,
    fontWeight: "600",
    marginRight: 12,
  },
  binaryOptionPercent: {
    fontSize: 14,
    fontWeight: "400",
  },
  payoutContainerStandalone: {
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
  },
  optionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  optionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: "400",
    flex: 1,
  },
  rightInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  optionPercentText: {
    fontSize: 12,
    fontWeight: "600",
  },
  binaryButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  binaryButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
  },
  binaryButtonLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  profitBadge: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  profitText: {
    fontSize: 12,
    fontWeight: '600',
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
    fontWeight: "400",
    color: "#000",
  },
  profitValue: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  payoutNote: {
    fontSize: 10,
    color: "#8E8E93",
    marginTop: 8,
    fontStyle: "italic",
  },
  bettingBar: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#C6C6C8",
  },
  guidedBetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  guidedStepLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  guidedStepTitle: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: "600",
  },
  reviewBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reviewBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  balanceContainer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  oneTapToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  oneTapLabel: {
    fontSize: 12,
    fontWeight: "400",
  },
  helpIcon: {
    padding: 2,
  },
  hintContainer: {
    marginBottom: 12,
    padding: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Brand.primary,
  },
  hintText: {
    fontSize: 11,
    lineHeight: 16,
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
    fontWeight: "400",
    color: "#000",
    height: 50,
  },
  placeBetButton: {
    backgroundColor: Brand.primary,
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
    fontWeight: "400",
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
  positionLabel: { fontSize: 16, fontWeight: '400', color: '#000' },
  positionStatus: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  positionMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  positionText: { fontSize: 13, color: '#8E8E93' },
  quickBetContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  quickBetChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 50,
    alignItems: 'center',
  },
  quickBetText: {
    fontSize: 13,
    fontWeight: '400',
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
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  headerImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 380,
    zIndex: 0,
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
});

