import { AnymarktLoader } from "@/components/AnymarktLoader";
import { GlobalHeader } from "@/components/GlobalHeader";
import { MarketChatTab } from "@/components/MarketChatTab";
import { MarketProbabilityChart } from "@/components/MarketProbabilityChart";
import { MarketTradePanel } from "@/components/markets/MarketTradePanel";
import { SEO } from "@/components/SEO";
import { SocialShareMarketCard } from "@/components/SocialShareMarketCard";
import { SettlementFeedbackFlow } from "@/components/group-member/SettlementFeedbackFlow";
import { SettlementPayoutBanner } from "@/components/group-member/SettlementPayoutBanner";
import {
  AppButton,
  AppIconButton,
  AppInput,
  AppScreen,
  AppText,
  ErrorBanner,
} from "@/components/ui";
import { DESKTOP_BREAKPOINT } from "@/constants/layout";
import { useAppLocale } from "@/contexts/LocaleContext";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useWalletContext } from "@/contexts/WalletContext";
import { useMarket } from "@/hooks/useMarket";
import { usePremiumNavigation } from "@/hooks/usePremiumNavigation";
import { useSettlementFeedbackPrompt } from "@/hooks/useSettlementFeedbackPrompt";
import { alertBetPlacedWithContract } from "@/lib/bet-contract-ui";
import { scanMarketTextForSports } from "@/lib/compliance/sports-content";
import { getBinaryOptions, isBinaryMarket } from "@/lib/market-utils";
import { calculateYesNoPayout, formatCurrency } from "@/lib/parimutuel";
import { getParamString } from "@/lib/route-params";
import { betService } from "@/services/bet.service";
import { shareService } from "@/services/share.service";
import { addAppBreadcrumb, captureUiError, showAppAlertRaw } from "@/lib/ui/feedback";
import type { MarketWithStats } from "@/types/market";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  useWindowDimensions,
  View,
} from "react-native";


// Responsive layout constants
const { width: windowWidth } = Dimensions.get('window');
const MAX_WEB_WIDTH = 600;
// We subtract 32 for padding (16 left + 16 right)
const contentWidth = Platform.OS === 'web' ? Math.min(windowWidth, MAX_WEB_WIDTH) - 32 : windowWidth - 32;

export function MarketScreen() {
  const router = useRouter();
  const { navigate } = usePremiumNavigation();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && windowWidth >= DESKTOP_BREAKPOINT;
  const params = useLocalSearchParams<{ id: string; optionId?: string; previewAmount?: string; side?: string; tab?: string }>();
  const marketId = getParamString(params.id) ?? null;
  const { market, options, userBets, loading, refresh } = useMarket(marketId);
  const { user } = useAuthContext();
  const settlementFeedback = useSettlementFeedbackPrompt({
    market: market ?? null,
    userId: user?.id,
    enabled: !loading && !!market?.group_id && market.status === "resolved",
    userHasBet: (userBets?.length ?? 0) > 0,
  });
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
    return <AnymarktLoader message="Preparing the market..." />;
  }

  if (!market) {
    return (
      <AppScreen columnVariant="standard" style={styles.centerContainer}>
        <AppText variant="body" color="destructive" style={styles.errorText}>
          This market could not be found. Go back and choose another prediction.
        </AppText>
        <AppButton
          title="Go back"
          variant="ghost"
          onPress={() => router.back()}
          style={{ marginTop: theme.spacing.lg }}
        />
      </AppScreen>
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

    const { bet, error: betError, contractPipeline } = await betService.placeBet({
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
      captureUiError(betError, "MarketScreen", "placeBet");
      showAppAlertRaw("Bet wasn't placed", errorMessage);
    } else {
      addAppBreadcrumb("bet", "Bet placed", {
        marketId: resolvedMarketId,
        amount,
        side: selectedSide,
        isPlayMode,
      });
      setBettingAmount("");
      setSelectedOption(null);
      setSelectedSide(null);
      setError(null);
      refreshWallet();
      refresh();
      notifyBetPlaced();
      alertBetPlacedWithContract({
        router,
        betId: bet?.id,
        isPlayMode,
        contractPipeline,
      });
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
    market.description || `Predict how this market resolves with friends on Anymarkt.`,
    leadingOptions ? `Current predictions: ${leadingOptions}.` : null,
    totalPool > 0 ? `$${totalPool.toLocaleString()} predicted so far.` : null,
  ].filter(Boolean).join(" ");

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SEO 
        title={`Predict: ${market.question}`}
        description={marketPreviewDescription}
        image={market.image_url || undefined}
        imageAlt={`Anymarkt prediction market: ${market.question}`}
        url={`/market/${resolvedMarketId}`}
        locale={locale === "es" ? "es_ES" : "en_US"}
      />
      
      {/* Background Image Header — hidden on desktop web (Polymarket-style text-first) */}
      {!isDesktopWeb ? (
      <View style={styles.headerImageContainer}>
        {market.image_url ? (
          <Image
            source={{ uri: market.image_url }}
            style={styles.headerImage}
            contentFit="cover"
            transition={300}
          />
        ) : (
          <View style={[styles.headerImage, { backgroundColor: theme.muted }]} />
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'transparent', theme.background]}
          locations={[0, 0.4, 1]}
          style={styles.headerGradient}
        />
      </View>
      ) : null}

      <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* Global Header with Mode Toggle */}
        <GlobalHeader
          transparent={!isDesktopWeb}
          ignoreTopInset={!isDesktopWeb}
          left={
            <AppIconButton
              variant="onDark"
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              style={{ backgroundColor: theme.overlay, borderColor: theme.borderSubtle }}
              icon={<Ionicons name="chevron-back" size={22} color={theme.onPrimary} />}
            />
          }
          right={
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <AppIconButton
                variant="onDark"
                accessibilityLabel="Share market"
                onPress={handleShare}
                style={{ backgroundColor: theme.overlay, borderColor: theme.borderSubtle }}
                icon={<Ionicons name="share-outline" size={20} color={theme.onPrimary} />}
              />
              <View style={styles.headerContent}>
                <View
                  style={{
                    backgroundColor: theme.overlay,
                    paddingHorizontal: theme.spacing.sm,
                    paddingVertical: theme.spacing.xs,
                    borderRadius: theme.radius.pill,
                    overflow: "hidden",
                  }}
                >
                  <AppText variant="caption" color="onPrimary" style={{ letterSpacing: 0.5 }}>
                    {(market.status || "open").toUpperCase()}
                  </AppText>
                </View>
              </View>
            </View>
          }
        />

        <View style={[
          styles.questionContainer, 
          { 
            backgroundColor: theme.surface, 
            borderBottomColor: theme.border,
            marginTop: isDesktopWeb ? 0 : 140 
          }
        ]}>
          <AppText variant="title1" style={styles.question}>{market.question}</AppText>
          {market.group_id && market.status === "resolved" ? (
            <SettlementPayoutBanner
              payoutStatus={(market as { payout_status?: string }).payout_status}
              payoutReleaseAt={(market as { payout_release_at?: string }).payout_release_at}
              overrideStatus={(market as { settlement_override_status?: string }).settlement_override_status}
              locale={locale === "es" ? "es-EC" : "en-US"}
            />
          ) : null}
          {market.description && (
            <AppText variant="body" color="secondary" style={styles.description}>
              {market.description}
            </AppText>
          )}
          <Pressable
            style={styles.poolContainer}
            onPress={() => navigate(`/bet/${resolvedMarketId}`, { message: "Loading market activity..." })}
            accessibilityRole="button"
            accessibilityLabel="View pool distribution"
          >
            <View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <AppText variant="caption" color="secondary" style={styles.poolLabel}>
                  Pool:{" "}
                </AppText>
                <AppText variant="title3">{formatCurrency(totalPool)}</AppText>
              </View>
              <AppText variant="caption" color="secondary" style={{ marginTop: 4 }}>
                Fees apply. Click for distribution.
              </AppText>
            </View>
          </Pressable>
        </View>

        <View style={isDesktopWeb ? styles.desktopBody : undefined}>
        <View style={isDesktopWeb ? styles.desktopMain : { flex: 1 }}>

        <View style={[styles.tabContainer, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <Pressable
            style={[styles.tabButton, activeTab === "predict" && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab("predict")}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "predict" }}
          >
            <AppText variant="bodySm" color={activeTab === "predict" ? "primary" : "secondary"}>
              Predict
            </AppText>
          </Pressable>
          {market.is_public && (
            <Pressable
              style={[styles.tabButton, activeTab === "chat" && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab("chat")}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === "chat" }}
            >
              <AppText variant="bodySm" color={activeTab === "chat" ? "primary" : "secondary"}>
                Live Chat
              </AppText>
            </Pressable>
          )}
          <Pressable
            style={[styles.tabButton, activeTab === "chart" && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab("chart")}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "chart" }}
          >
            <AppText variant="bodySm" color={activeTab === "chart" ? "primary" : "secondary"}>
              Chart
            </AppText>
          </Pressable>
        </View>

        {/* Chat tab renders directly (has its own FlatList) - avoids VirtualizedList nesting */}
        {activeTab === 'chat' && (
          <MarketChatTab marketId={resolvedMarketId} />
        )}

        {/* Other tabs render in ScrollView */}
        {activeTab !== 'chat' && (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {isEcSportsBlocked && (
              <View
                style={[
                  styles.sportsBlockBanner,
                  {
                    backgroundColor: `${theme.error}1F`,
                    borderColor: theme.error,
                    borderRadius: theme.radius.md,
                  },
                ]}
              >
                <AppText variant="body" color="destructive">
                  {t("sportsMarketBlockedTitle")}
                </AppText>
                <AppText variant="bodySm" color="secondary">
                  {t("sportsMarketBlockedBody")}
                </AppText>
                {isPlayMode ? (
                  <AppText variant="caption" color="secondary" style={{ marginTop: 2 }}>
                    {t("sportsMarketPracticeNote")}
                  </AppText>
                ) : null}
              </View>
            )}
            {activeTab === 'predict' && (
              <View style={styles.optionsContainer}>
                <View style={[styles.beginnerGuideCard, { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: theme.radius.lg }]}>
                  <View
                    style={[
                      styles.modePill,
                      {
                        backgroundColor: isPlayMode ? theme.primarySoft : theme.muted,
                        borderRadius: theme.radius.pill,
                      },
                    ]}
                  >
                    <AppText variant="caption" color={isPlayMode ? "primary" : "success"}>
                      {isPlayMode ? "Practice mode" : "Live mode"}
                    </AppText>
                  </View>
                  <AppText variant="title2" style={styles.guideTitle}>
                    Place your first prediction in 3 steps
                  </AppText>
                  <AppText variant="bodySm" color="secondary">
                    Choose an outcome, pick an amount, then review the possible payout before confirming.
                  </AppText>
                </View>

                <AppText variant="label" color="secondary" style={styles.sectionTitle}>1. Choose an outcome</AppText>
                
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
                      <Pressable
                        style={[
                          styles.binaryOptionCard,
                          {
                            backgroundColor: isDark ? theme.surfaceElevated : theme.surface,
                            borderColor: isYesSelected ? theme.primary : theme.borderSubtle,
                            borderRadius: theme.radius.md,
                          },
                          isYesSelected && styles.optionSelected,
                        ]}
                        onPress={() => {
                          setSelectedOption(yesOption.id);
                          setSelectedSide("yes");
                          Haptics.selectionAsync();
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isYesSelected }}
                      >
                        <View
                          style={[
                            styles.progressBarContainer,
                            {
                              width: `${yesPercent}%`,
                              backgroundColor: theme.primary,
                              opacity: isDark ? 0.3 : 0.1,
                            },
                          ]}
                        />
                        <View style={styles.binaryOptionContent}>
                          <AppText
                            variant="title2"
                            color={isYesSelected ? (isDark ? "onPrimary" : "primary") : "default"}
                            style={styles.binaryOptionLabel}
                          >
                            Yes
                          </AppText>
                          <AppText
                            variant="title3"
                            color={isYesSelected ? (isDark ? "onPrimary" : "primary") : "default"}
                            style={styles.binaryOptionPrice}
                          >
                            {yesCents}¢
                          </AppText>
                          <AppText
                            variant="bodySm"
                            color={isYesSelected ? (isDark ? "onPrimary" : "primary") : "secondary"}
                          >
                            {Math.round(yesPercent)}%
                          </AppText>
                        </View>
                      </Pressable>

                      {/* No Option */}
                      <Pressable
                        style={[
                          styles.binaryOptionCard,
                          {
                            backgroundColor: isDark ? theme.surfaceElevated : theme.surface,
                            borderColor: isNoSelected ? theme.error : theme.borderSubtle,
                            borderRadius: theme.radius.md,
                          },
                          isNoSelected && styles.optionSelected,
                        ]}
                        onPress={() => {
                          setSelectedOption(noOption.id);
                          setSelectedSide("yes");
                          Haptics.selectionAsync();
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isNoSelected }}
                      >
                        <View
                          style={[
                            styles.progressBarContainer,
                            { width: `${noPercent}%`, backgroundColor: theme.error, opacity: 0.3 },
                          ]}
                        />
                        <View style={styles.binaryOptionContent}>
                          <AppText variant="title2" color={isNoSelected ? "destructive" : "default"} style={styles.binaryOptionLabel}>
                            No
                          </AppText>
                          <AppText variant="title3" color="destructive" style={styles.binaryOptionPrice}>
                            {noCents}¢
                          </AppText>
                          <AppText variant="bodySm" color={isNoSelected ? "destructive" : "secondary"}>
                            {Math.round(noPercent)}%
                          </AppText>
                        </View>
                      </Pressable>

                      {/* Payout Preview for Binary */}
                      {potentialPayout && (isYesSelected || isNoSelected) && (
                        <View
                          style={[
                            styles.payoutContainerStandalone,
                            {
                              backgroundColor: isDark ? theme.surfaceElevated : theme.surface,
                              borderColor: theme.border,
                              borderRadius: theme.radius.md,
                            },
                          ]}
                        >
                          <View style={styles.payoutRow}>
                            <AppText variant="caption" color="secondary">
                              Your Bet
                            </AppText>
                            <AppText variant="caption">{formatCurrency(potentialPayout.userBet)}</AppText>
                          </View>
                          <View style={styles.payoutRow}>
                            <AppText variant="caption" color="secondary">
                              If You Win, You Get Back
                            </AppText>
                            <AppText variant="caption">{formatCurrency(potentialPayout.netPayout)}</AppText>
                          </View>
                          <View
                            style={[
                              styles.payoutRow,
                              {
                                marginTop: 4,
                                paddingTop: 4,
                                borderTopWidth: StyleSheet.hairlineWidth,
                                borderTopColor: theme.border,
                              },
                            ]}
                          >
                            <AppText variant="caption" color="secondary">
                              Net Profit
                            </AppText>
                            <AppText variant="label" color="success">
                              +{formatCurrency(potentialPayout.potentialProfit)}
                            </AppText>
                          </View>
                          <AppText variant="caption" color="secondary" style={styles.payoutNote}>
                            After fee: {(1 - 0.0795) * 100}% payout
                          </AppText>
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
                          backgroundColor: isDark ? theme.surfaceElevated : theme.surface,
                          borderColor: isSelected ? accentColor : theme.borderSubtle,
                          borderRadius: theme.radius.md,
                        },
                        isSelected && styles.optionSelected,
                      ]}
                    >
                      {/* Percentage fill background - transparent blue for all */}
                      <View
                        style={[
                          styles.progressBarContainer,
                          {
                            width: `${percent}%`,
                            backgroundColor: accentColor,
                            opacity: 0.15,
                          },
                        ]}
                      />

                      <View style={styles.optionHeader}>
                        <View style={styles.optionLeft}>
                          <View
                            style={[
                              styles.optionDot,
                              {
                                backgroundColor: isSelected
                                  ? accentColor
                                  : theme.borderSubtle,
                                borderRadius: theme.radius.pill,
                              },
                            ]}
                          />
                          <AppText
                            variant="label"
                            color={isSelected ? (isDark ? "onPrimary" : "primary") : "default"}
                            style={styles.optionLabel}
                          >
                            {option.label}
                          </AppText>
                        </View>
                        <AppText
                          variant="caption"
                          color={isSelected ? (isDark ? "onPrimary" : "primary") : "secondary"}
                        >
                          {Math.round(percent)}%
                        </AppText>
                      </View>

                      <View style={styles.binaryButtons}>
                        <AppButton
                          title={`YES ${yesCents}¢`}
                          size="sm"
                          variant={isYesSelected ? "primary" : "secondary"}
                          onPress={() => {
                            setSelectedOption(option.id);
                            setSelectedSide("yes");
                            Haptics.selectionAsync();
                          }}
                          style={[
                            styles.binaryButton,
                            {
                              borderRadius: theme.radius.sm,
                              borderColor: isYesSelected ? theme.primary : theme.border,
                              borderWidth: isYesSelected ? 2 : 1,
                            },
                          ]}
                        />
                        <AppButton
                          title={`NO ${noCents}¢`}
                          size="sm"
                          variant={isNoSelected ? "destructive" : "secondary"}
                          onPress={() => {
                            setSelectedOption(option.id);
                            setSelectedSide("no");
                            Haptics.selectionAsync();
                          }}
                          style={[
                            styles.binaryButton,
                            {
                              borderRadius: theme.radius.sm,
                              borderColor: isNoSelected ? theme.error : theme.border,
                              borderWidth: isNoSelected ? 2 : 1,
                            },
                          ]}
                        />
                      </View>

                      {potentialPayout && (isYesSelected || isNoSelected) && (
                        <View style={[styles.payoutContainer, { borderTopColor: theme.border }]}>
                          <View style={styles.payoutRow}>
                            <AppText variant="caption" color="secondary">
                              Your Bet
                            </AppText>
                            <AppText variant="caption">{formatCurrency(potentialPayout.userBet)}</AppText>
                          </View>
                          <View style={styles.payoutRow}>
                            <AppText variant="caption" color="secondary">
                              If You Win, You Get Back
                            </AppText>
                            <AppText variant="caption">{formatCurrency(potentialPayout.netPayout)}</AppText>
                          </View>
                          <View
                            style={[
                              styles.payoutRow,
                              {
                                marginTop: 4,
                                paddingTop: 4,
                                borderTopWidth: StyleSheet.hairlineWidth,
                                borderTopColor: theme.border,
                              },
                            ]}
                          >
                            <AppText variant="caption" color="secondary">
                              Net Profit
                            </AppText>
                            <AppText variant="label" color="success">
                              +{formatCurrency(potentialPayout.potentialProfit)}
                            </AppText>
                          </View>
                          <AppText variant="caption" color="secondary" style={styles.payoutNote}>
                            After fee: {(1 - 0.0795) * 100}% payout
                          </AppText>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
            
            {activeTab === "chart" && (
              <View style={styles.positionSection}>
                <View style={[styles.chartContainer, { borderRadius: theme.radius.lg, backgroundColor: theme.muted }]}>
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

        </View>

        {isDesktopWeb && activeTab === 'predict' && (
          <MarketTradePanel
            balance={balance}
            totalPool={totalPool}
            isPlayMode={isPlayMode}
            hasSelection={Boolean(selectedOption && selectedSide)}
            theme={theme}
          />
        )}

        </View>

        {selectedOption && selectedSide && !(isDesktopWeb && activeTab === "predict") && (
          <View style={[
            styles.bettingBar,
            { backgroundColor: theme.surface, borderTopColor: theme.border },
          ]}>
            <View style={styles.guidedBetHeader}>
              <View>
                <AppText variant="caption" color="secondary" style={styles.guidedStepLabel}>
                  2. Choose amount
                </AppText>
                <AppText variant="title2" style={styles.guidedStepTitle}>
                  {isPlayMode ? "Practice bet" : "Live bet"}
                </AppText>
              </View>
              <View
                style={[
                  styles.reviewBadge,
                  {
                    backgroundColor: isPlayMode ? theme.primarySoft : theme.muted,
                    borderRadius: theme.radius.pill,
                  },
                ]}
              >
                <AppText variant="caption" color={isPlayMode ? "primary" : "success"}>
                  Review before confirm
                </AppText>
              </View>
            </View>
            <View style={styles.balanceRow}>
              <View style={styles.balanceContainer}>
                <AppText variant="label" color="secondary">
                  Funds Available
                </AppText>
                <AppText variant="label">{formatCurrency(balance)}</AppText>
              </View>

              <View style={styles.oneTapToggleRow}>
                <AppIconButton
                  variant="ghost"
                  accessibilityLabel="One-tap bet help"
                  onPress={() => setShowOneTapHint(!showOneTapHint)}
                  style={{ width: 32, height: 32 }}
                  icon={<Ionicons name="help-circle-outline" size={16} color={theme.textSecondary} />}
                />
                <AppText variant="caption" color="secondary">
                  Advanced one-tap
                </AppText>
                <Switch
                  value={oneTapBetEnabled}
                  onValueChange={setOneTapBetEnabled}
                  ios_backgroundColor={theme.muted}
                  trackColor={{ false: theme.muted, true: theme.primary }}
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
              </View>
            </View>

            {showOneTapHint && (
              <View
                style={[
                  styles.hintContainer,
                  {
                    backgroundColor: theme.primarySoft,
                    borderRadius: theme.radius.sm,
                    borderLeftColor: theme.primary,
                  },
                ]}
              >
                <AppText variant="caption" color="secondary">
                  Advanced mode places the bet as soon as you tap an amount.
                </AppText>
              </View>
            )}

            <View style={styles.quickBetContainer}>
              {[0.1, 0.5, 1.0, 5.0].map((amt) => (
                <AppButton
                  key={amt}
                  title={`$${amt.toFixed(2)}`}
                  size="sm"
                  variant="secondary"
                  style={[
                    styles.quickBetChip,
                    {
                      backgroundColor: theme.muted,
                      borderRadius: theme.radius.pill,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setBettingAmount(amt.toFixed(2));
                    setError(null);

                    if (oneTapBetEnabled && selectedOption && selectedSide && !isPlacingBet && amt <= balance) {
                      const placeAutoBet = async () => {
                        setIsPlacingBet(true);
                        setError(null);

                        const { bet, error: betError, contractPipeline } = await betService.placeBet({
                          marketId: resolvedMarketId,
                          optionId: selectedOption,
                          amount: amt,
                          side: selectedSide,
                          isPlayMode,
                        });

                        setIsPlacingBet(false);

                        if (betError) {
                          const errorMessage =
                            betError.message || "We couldn't place your one-tap bet. Try again.";
                          setError(errorMessage);
                          captureUiError(betError, "MarketScreen", "oneTapPlaceBet");
                          showAppAlertRaw("Bet wasn't placed", errorMessage);
                        } else {
                          addAppBreadcrumb("bet", "One-tap bet placed", {
                            marketId: resolvedMarketId,
                            amount: amt,
                            side: selectedSide,
                            isPlayMode,
                          });
                          setBettingAmount("");
                          setSelectedOption(null);
                          setSelectedSide(null);
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          refreshWallet();
                          refresh();
                          notifyBetPlaced();
                          alertBetPlacedWithContract({
                            router,
                            betId: bet?.id,
                            isPlayMode,
                            contractPipeline,
                          });
                        }
                      };
                      placeAutoBet();
                    } else if (!selectedOption || !selectedSide) {
                      setError("Choose YES or NO before using one-tap amounts.");
                    }
                  }}
                />
              ))}
            </View>

            <View style={styles.betInputContainer}>
              <View style={styles.betInputField}>
                <AppInput
                  placeholder="$0"
                  value={bettingAmount}
                  onChangeText={(text) => {
                    setBettingAmount(text);
                    setError(null);
                  }}
                  keyboardType="numeric"
                  autoFocus={false}
                />
              </View>
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
                  <AppButton
                    title={isPlacingBet ? `Placing ${isPlayMode ? "practice" : "live"} bet…` : `Place ${isPlayMode ? "practice" : "live"} bet`}
                    loading={isPlacingBet}
                    disabled={isDisabled}
                    onPress={handlePlaceBet}
                    style={styles.placeBetButton}
                  />
                );
              })()}
            </View>
            {error ? <ErrorBanner message={error} /> : null}
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

      {settlementFeedback.promptMarket ? (
        <SettlementFeedbackFlow
          visible={settlementFeedback.visible}
          marketId={settlementFeedback.promptMarket.id}
          marketQuestion={settlementFeedback.promptMarket.question}
          onSkip={() => void settlementFeedback.dismiss()}
          onNotSure={settlementFeedback.closeWithoutPersist}
          onSubmit={settlementFeedback.submitRating}
        />
      ) : null}
      </SafeAreaView>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingBottom: 120,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
    gap: 12,
  },
  questionContainer: {
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  question: {
    marginBottom: 8,
    letterSpacing: -1,
  },
  description: {
    marginBottom: 20,
  },
  poolContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  poolLabel: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chartContainer: {
    marginBottom: 24,
    alignItems: "center",
    paddingVertical: 16,
  },
  optionsContainer: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  beginnerGuideCard: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 18,
  },
  sportsBlockBanner: {
    borderWidth: 1,
    padding: 14,
    gap: 6,
    marginBottom: 12,
    marginHorizontal: 16,
    marginTop: 12,
  },
  modePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  guideTitle: {
    marginBottom: 6,
  },
  positionSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    textTransform: "uppercase",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  optionCard: {
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
    flex: 1,
  },
  binaryOptionPrice: {
    marginRight: 12,
  },
  payoutContainerStandalone: {
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
  },
  optionLabel: {
    flex: 1,
  },
  binaryButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  binaryButton: {
    flex: 1,
  },
  payoutContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  payoutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  payoutNote: {
    marginTop: 8,
    fontStyle: "italic",
  },
  desktopBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
  },
  desktopMain: {
    flex: 1,
    minWidth: 0,
  },
  bettingBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 20 : 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  guidedBetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  guidedStepLabel: {
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  guidedStepTitle: {
    marginTop: 2,
  },
  reviewBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
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
  hintContainer: {
    marginBottom: 12,
    padding: 8,
    borderLeftWidth: 3,
  },
  betInputContainer: {
    flexDirection: "row",
    gap: 12,
  },
  betInputField: {
    flex: 1,
  },
  placeBetButton: {
    alignSelf: "stretch",
    minWidth: 148,
  },
  errorText: {
    textAlign: "center",
    paddingHorizontal: 24,
  },
  quickBetContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  quickBetChip: {
    minWidth: 50,
  },
  tabContainer: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  headerImageContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 380,
    zIndex: 0,
  },
  headerImage: {
    width: "100%",
    height: "100%",
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
});

