import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/ThemeContext";
import { getBinaryOptions, isBinaryMarket } from "@/lib/market-utils";
import { calculateYesNoPayout, formatCurrency } from "@/lib/parimutuel";
import type { Market, MarketWithStats } from "@/types/market";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const QUICK_AMOUNTS = [10, 25, 50] as const;

const ACCENT = {
  yes: "#6EE7A8",
  no: "#F0A8A8",
} as const;

export interface FeedTradeParams {
  side: "yes" | "no";
  optionId: string;
  amount?: number;
}

export interface FeedTradingPanelProps {
  market: Market;
  stats: MarketWithStats | null;
  variant?: "immersive" | "surface";
  selectedOptionId?: string | null;
  onSelectOption?: (optionId: string) => void;
  previewAmount?: string;
  onPreviewAmountChange?: (amount: string) => void;
  onTrade: (params: FeedTradeParams) => void;
  showAmountInput?: boolean;
  isPlayMode?: boolean;
  loading?: boolean;
}

function toCents(price: number | undefined) {
  if (!Number.isFinite(price)) return 50;
  const normalized = price! <= 1 ? price! : price! / 100;
  return Math.max(1, Math.min(99, Math.round(normalized * 100)));
}

export function FeedTradingPanel({
  market,
  stats,
  variant = "surface",
  selectedOptionId,
  onSelectOption,
  previewAmount: controlledAmount,
  onPreviewAmountChange,
  onTrade,
  showAmountInput = true,
  isPlayMode = false,
  loading = false,
}: FeedTradingPanelProps) {
  const { theme } = useTheme();
  const [internalAmount, setInternalAmount] = useState("");

  const previewAmount = controlledAmount ?? internalAmount;
  const setPreviewAmount = onPreviewAmountChange ?? setInternalAmount;

  const parsedAmount = parseFloat(previewAmount);
  const hasAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;

  const binary = stats ? isBinaryMarket(market, stats.optionStats) : false;
  const binaryOptions = stats ? getBinaryOptions(stats.optionStats) : null;

  const activeOptionId = useMemo(() => {
    if (binaryOptions) {
      return selectedOptionId ?? binaryOptions.yesOption.optionId;
    }
    if (selectedOptionId) return selectedOptionId;
    return stats?.optionStats[0]?.optionId ?? null;
  }, [binaryOptions, selectedOptionId, stats?.optionStats]);

  useEffect(() => {
    if (!stats || binary || !onSelectOption) return;
    if (!selectedOptionId && stats.optionStats[0]) {
      onSelectOption(stats.optionStats[0].optionId);
    }
  }, [binary, onSelectOption, selectedOptionId, stats]);

  const immersive = variant === "immersive";

  const panelStyles = immersive
    ? {
        backgroundColor: "rgba(8, 12, 20, 0.55)",
        borderColor: "rgba(255,255,255,0.1)",
        text: "#fff",
        textMuted: "rgba(255,255,255,0.55)",
        inputBg: "rgba(255,255,255,0.05)",
        chipBg: "rgba(255,255,255,0.05)",
        chipBorder: "rgba(255,255,255,0.1)",
        chipActiveBorder: "rgba(255,255,255,0.28)",
        buttonBorder: "rgba(255,255,255,0.14)",
        track: "rgba(255,255,255,0.08)",
        trackFill: "rgba(255,255,255,0.35)",
      }
    : {
        backgroundColor: theme.surface,
        borderColor: theme.border,
        text: theme.text,
        textMuted: theme.textSecondary,
        inputBg: theme.card,
        chipBg: theme.card,
        chipBorder: theme.border,
        chipActiveBorder: theme.textSecondary,
        buttonBorder: theme.border,
        track: theme.card,
        trackFill: theme.textSecondary,
      };

  const handleQuickAmount = (amount: number) => {
    Haptics.selectionAsync();
    setPreviewAmount(amount.toFixed(0));
  };

  const handleTrade = (side: "yes" | "no", optionId: string, event?: { stopPropagation?: () => void }) => {
    event?.stopPropagation?.();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTrade({
      side,
      optionId,
      ...(hasAmount ? { amount: parsedAmount } : {}),
    });
  };

  const renderPayout = (side: "yes" | "no", yesPrice: number, noPrice: number) => {
    if (!hasAmount) return null;
    const price = side === "yes" ? yesPrice : noPrice;
    const payout = calculateYesNoPayout(parsedAmount, price, 0.0795).netPayout;
    return (
      <Text style={[styles.payoutHint, { color: panelStyles.textMuted }]}>
        Win {formatCurrency(payout)}
      </Text>
    );
  };

  const renderAmountControls = () => {
    if (!showAmountInput) return null;

    return (
      <View style={styles.amountSection} onStartShouldSetResponder={() => true}>
        <View style={[styles.amountInputWrap, { backgroundColor: panelStyles.inputBg, borderColor: panelStyles.chipBorder }]}>
          <Text style={[styles.dollarSign, { color: panelStyles.textMuted }]}>$</Text>
          <TextInput
            style={[styles.amountInput, { color: panelStyles.text }]}
            placeholder="Amount"
            placeholderTextColor={panelStyles.textMuted}
            value={previewAmount}
            onChangeText={setPreviewAmount}
            keyboardType="decimal-pad"
            maxLength={7}
          />
        </View>
        <View style={styles.quickAmounts}>
          {QUICK_AMOUNTS.map((amount) => {
            const active = previewAmount === amount.toFixed(0) || previewAmount === String(amount);
            return (
              <TouchableOpacity
                key={amount}
                style={[
                  styles.quickChip,
                  {
                    backgroundColor: panelStyles.chipBg,
                    borderColor: active ? panelStyles.chipActiveBorder : panelStyles.chipBorder,
                  },
                ]}
                onPress={() => handleQuickAmount(amount)}
                activeOpacity={0.85}
              >
                <Text style={[styles.quickChipText, { color: active ? panelStyles.text : panelStyles.textMuted }]}>
                  ${amount}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  if (loading && !stats) {
    return (
      <View style={[styles.panel, { backgroundColor: panelStyles.backgroundColor, borderColor: panelStyles.borderColor }]}>
        <ActivityIndicator color={panelStyles.textMuted} />
      </View>
    );
  }

  if (!stats) return null;

  const loadingOverlay = loading ? (
    <View style={styles.loadingOverlay}>
      <ActivityIndicator color={panelStyles.textMuted} size="small" />
    </View>
  ) : null;

  const modeLabel = isPlayMode ? "Practice" : "Live";

  if (binaryOptions) {
    const yesPrice = binaryOptions.yesOption.yesPrice ?? 0.5;
    const noPrice = binaryOptions.noOption.yesPrice ?? 0.5;
    const yesCents = toCents(yesPrice);
    const noCents = toCents(noPrice);
    const chance = yesCents;

    return (
      <View style={[styles.panel, styles.panelRelative, { backgroundColor: panelStyles.backgroundColor, borderColor: panelStyles.borderColor }]}>
        {loadingOverlay}
        <View style={styles.probabilityHeader}>
          <View style={styles.chanceRow}>
            <Text style={[styles.chanceValue, { color: panelStyles.text }]}>{chance}%</Text>
            <Text style={[styles.chanceLabel, { color: panelStyles.textMuted }]}>chance · {modeLabel}</Text>
          </View>
          <View style={[styles.probabilityTrack, { backgroundColor: panelStyles.track }]}>
            <View style={[styles.probabilityYes, { width: `${yesCents}%`, backgroundColor: panelStyles.trackFill }]} />
          </View>
        </View>

        {renderAmountControls()}

        <View style={styles.tradeRow}>
          <TouchableOpacity
            style={[styles.tradeButton, { borderColor: panelStyles.buttonBorder, backgroundColor: "transparent" }]}
            onPress={(event) => handleTrade("yes", binaryOptions.yesOption.optionId, event)}
            activeOpacity={0.85}
          >
            <Text style={[styles.tradeButtonLabel, { color: immersive ? ACCENT.yes : theme.success }]}>Yes</Text>
            <Text style={[styles.tradeButtonPrice, { color: panelStyles.text }]}>{yesCents}¢</Text>
            {renderPayout("yes", yesPrice, noPrice)}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tradeButton, { borderColor: panelStyles.buttonBorder, backgroundColor: "transparent" }]}
            onPress={(event) => handleTrade("no", binaryOptions.noOption.optionId, event)}
            activeOpacity={0.85}
          >
            <Text style={[styles.tradeButtonLabel, { color: immersive ? ACCENT.no : theme.error }]}>No</Text>
            <Text style={[styles.tradeButtonPrice, { color: panelStyles.text }]}>{noCents}¢</Text>
            {renderPayout("no", yesPrice, noPrice)}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderOptionRow = (option: (typeof stats.optionStats)[number]) => {
    const selected = activeOptionId === option.optionId;
    const cents = toCents(option.yesPrice);
    const fillWidth = option.percentage > 0 ? Math.max(4, Math.round(option.percentage)) : 0;

    return (
      <TouchableOpacity
        key={option.optionId}
        style={[
          styles.optionRow,
          {
            backgroundColor: immersive
              ? selected
                ? "rgba(255,255,255,0.08)"
                : "rgba(255,255,255,0.03)"
              : selected
                ? theme.card
                : theme.background,
            borderColor: selected ? panelStyles.chipActiveBorder : panelStyles.chipBorder,
          },
        ]}
        onPress={() => {
          Haptics.selectionAsync();
          onSelectOption?.(option.optionId);
        }}
        activeOpacity={0.85}
      >
        {fillWidth > 0 && (
          <View
            style={[
              styles.optionFill,
              {
                width: `${fillWidth}%`,
                backgroundColor: panelStyles.trackFill,
                opacity: selected ? 0.14 : 0.06,
              },
            ]}
          />
        )}
        <View style={styles.optionContent}>
          <Text style={[styles.optionLabel, { color: panelStyles.text }]} numberOfLines={1}>
            {option.label}
          </Text>
          <Text style={[styles.optionPrice, { color: panelStyles.textMuted }]}>{cents}¢</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.panel, styles.panelRelative, { backgroundColor: panelStyles.backgroundColor, borderColor: panelStyles.borderColor }]}>
      {loadingOverlay}
      <View style={styles.multiHeader}>
        <Text style={[styles.multiTitle, { color: panelStyles.text }]}>Pick an outcome</Text>
        <Text style={[styles.multiSubtitle, { color: panelStyles.textMuted }]}>
          {stats.optionStats.length} options · {modeLabel}
        </Text>
      </View>

      {stats.optionStats.length > 4 ? (
        <ScrollView style={styles.optionScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          <View style={styles.optionList}>
            {stats.optionStats.map(renderOptionRow)}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.optionList}>
          {stats.optionStats.map(renderOptionRow)}
        </View>
      )}

      {renderAmountControls()}

      {activeOptionId && (
        <TouchableOpacity
          style={[styles.singleTradeButton, { borderColor: panelStyles.buttonBorder, backgroundColor: "transparent" }]}
          onPress={(event) => handleTrade("yes", activeOptionId, event)}
          activeOpacity={0.85}
        >
          <Text style={[styles.singleTradeText, { color: panelStyles.text }]}>
            Trade {stats.optionStats.find((option) => option.optionId === activeOptionId)?.label ?? "option"}
          </Text>
          <IconSymbol name="arrow.right" size={13} color={panelStyles.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
  },
  panelRelative: {
    position: "relative",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    zIndex: 2,
  },
  probabilityHeader: {
    gap: 8,
  },
  chanceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  chanceValue: {
    fontSize: 22,
    fontWeight: "400",
    letterSpacing: -0.4,
    fontVariant: ["tabular-nums"],
  },
  chanceLabel: {
    fontSize: 13,
    fontWeight: "400",
  },
  probabilityTrack: {
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  probabilityYes: {
    height: "100%",
    borderRadius: 999,
  },
  amountSection: {
    width: "100%",
    gap: 8,
  },
  amountInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 40,
    width: "100%",
    maxWidth: "100%",
  },
  dollarSign: {
    fontSize: 14,
    fontWeight: "400",
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "400",
    paddingVertical: 8,
    minWidth: 0,
  },
  quickAmounts: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  quickChip: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  quickChipText: {
    fontSize: 13,
    fontWeight: "400",
    fontVariant: ["tabular-nums"],
  },
  tradeRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  tradeButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
    gap: 2,
  },
  tradeButtonLabel: {
    fontSize: 12,
    fontWeight: "400",
    letterSpacing: 0.2,
  },
  tradeButtonPrice: {
    fontSize: 18,
    fontWeight: "400",
    letterSpacing: -0.3,
    fontVariant: ["tabular-nums"],
  },
  payoutHint: {
    fontSize: 11,
    fontWeight: "400",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  multiHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  multiTitle: {
    fontSize: 14,
    fontWeight: "400",
  },
  multiSubtitle: {
    fontSize: 12,
    fontWeight: "400",
  },
  optionList: {
    gap: 8,
  },
  optionScroll: {
    maxHeight: 220,
  },
  optionRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: "hidden",
    minHeight: 42,
    position: "relative",
  },
  optionFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    minHeight: 42,
    gap: 12,
  },
  optionLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "400",
  },
  optionPrice: {
    fontSize: 14,
    fontWeight: "400",
    fontVariant: ["tabular-nums"],
  },
  singleTradeButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  singleTradeText: {
    fontSize: 14,
    fontWeight: "400",
  },
});
