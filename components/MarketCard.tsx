import { IconSymbol } from "@/components/ui/icon-symbol";
import { useMarketLikes } from "@/hooks/useMarketLikes";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { getBinaryOptions, isBinaryMarket } from "../lib/market-utils";
import { formatCurrency } from "../lib/parimutuel";
import type { Market, MarketOption } from "../types/market";

interface MarketCardProps {
  market: Market;
  options: MarketOption[];
  onSelectOption?: (optionId: string, side: "yes" | "no") => void;
  onResolve?: (optionId: string) => void;
  onViewDistribution?: () => void;
  compact?: boolean;
  canResolve?: boolean;
  isShared?: boolean;
}

function formatCloseTime(iso: string | null | undefined): string {
  if (!iso) return "No close time";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "No close time";

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MarketCard({
  market,
  options,
  onSelectOption,
  onResolve,
  onViewDistribution,
  compact = false,
  canResolve = false,
  isShared = false
}: MarketCardProps) {
  const { theme, isDark } = useTheme();
  const totalPool = options.reduce((sum, opt) => {
    const yesPool = Number(opt.yes_pool ?? opt.total_pool ?? 0);
    const noPool = Number(opt.no_pool ?? 0);
    return sum + yesPool + noPool;
  }, 0);



  const isResolved = market.status === 'resolved';

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: theme.surface,
        borderColor: theme.border,
        shadowOpacity: isDark ? 0.26 : 0.1,
      },
      compact && styles.compactContainer,
      isResolved && { opacity: 0.95 }
    ]}>
      {/* Top Section with Status and Timer */}
      <View style={styles.topRow}>
        <View style={styles.badgeRow}>
          <View style={[styles.statusBadge, { backgroundColor: market.status === 'open' ? theme.primarySoft : (isDark ? 'rgba(142, 142, 147, 0.15)' : '#F2F2F7') }]}>
            <View style={[styles.statusDot, { backgroundColor: market.status === 'open' ? theme.primary : theme.textSecondary }]} />
            <Text style={[styles.statusText, { color: market.status === 'open' ? theme.primary : theme.textSecondary }]}>
              {(market.status || 'open').toUpperCase()}
            </Text>
          </View>
          {isShared && (
            <View style={[styles.statusBadge, { backgroundColor: isDark ? 'rgba(52, 199, 89, 0.15)' : '#E8F5E9' }]}>
              <Text style={[styles.statusText, { color: isDark ? theme.success : '#2E7D32' }]}>PUBLIC</Text>
            </View>
          )}
        </View>
        <LikeButton marketId={market.id} isDark={isDark} theme={theme} />
      </View>

      <View style={styles.metaRow}>
        <Text style={[styles.metaText, { color: theme.textSecondary }]} numberOfLines={1}>
          {market.category || "General"}
        </Text>
        <View style={[styles.metaDot, { backgroundColor: theme.textSecondary }]} />
        <Text style={[styles.metaText, { color: theme.textSecondary }]} numberOfLines={1}>
          Closes {formatCloseTime(market.closes_at)}
        </Text>
      </View>

      <TouchableOpacity activeOpacity={0.9} onPress={onViewDistribution} disabled={!onViewDistribution}>
        <Text style={[styles.question, { color: theme.text }]} numberOfLines={compact ? 3 : undefined}>
          {market.question}
        </Text>
      </TouchableOpacity>

      {market.image_url && (
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: market.image_url }}
            style={styles.bannerImage}
            contentFit="cover"
            transition={300}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.4)']}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}

      <View style={styles.optionsContainer}>
        {/* Binary Market UI - Simple Yes/No buttons */}
        {isBinaryMarket(market, options) && !isResolved && (() => {
          const binary = getBinaryOptions(options);
          if (!binary) return null;
          
          const { yesOption, noOption } = binary;
          const yesPool = Number(yesOption.yes_pool ?? yesOption.total_pool ?? 0) + Number(yesOption.no_pool ?? 0);
          
          let yesPrice = totalPool > 0 ? yesPool / totalPool : 0.5;
          let noPrice = 1 - yesPrice;
          
          if (yesPrice < 0.01) { yesPrice = 0.01; noPrice = 0.99; }
          else if (yesPrice > 0.99) { yesPrice = 0.99; noPrice = 0.01; }
          
          const yesCents = Math.round(yesPrice * 100);
          const noCents = Math.round(noPrice * 100);
          
          return (
            <View style={styles.binaryContainer}>
              <View style={styles.binaryButtons}>
                <TouchableOpacity
                  testID="bet-side-yes"
                  style={[
                    styles.predictButton,
                    { 
                      backgroundColor: isDark ? theme.primarySoft : '#F0FFF1', 
                      borderColor: theme.primary, 
                      borderWidth: 1.5 
                    }
                  ]}
                  onPress={() => onSelectOption?.(yesOption.id, "yes")}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.predictLabel, { color: theme.primary }]}>YES</Text>
                  <Text style={[styles.predictPrice, { color: theme.primary }]}>{yesCents}¢</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.predictButton,
                    { 
                      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FFF1F0', 
                      borderColor: '#F87171', 
                      borderWidth: 1.5 
                    }
                  ]}
                  onPress={() => onSelectOption?.(noOption.id, "no")}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.predictLabel, { color: isDark ? '#FCA5A5' : '#EF4444' }]}>NO</Text>
                  <Text style={[styles.predictPrice, { color: isDark ? '#FEE2E2' : '#EF4444' }]}>{noCents}¢</Text>
                </TouchableOpacity>
              </View>
              {canResolve && (
                <View style={styles.resolveRow}>
                  <TouchableOpacity style={styles.adminAction} onPress={() => onResolve?.(yesOption.id)}>
                    <Text style={[styles.adminActionText, { color: theme.primary }]}>WIN YES</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.adminAction} onPress={() => onResolve?.(noOption.id)}>
                    <Text style={[styles.adminActionText, { color: '#EF4444' }]}>WIN NO</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })()}

        {/* Multi-option/Multi-choice UI */}
        {(!isBinaryMarket(market, options) || isResolved) && options.map((option) => {
          const isWinner = market.winning_option_id === option.id;
          const optionPool = Number(option.yes_pool ?? option.total_pool ?? 0) + Number(option.no_pool ?? 0);
          const percent = totalPool > 0 ? (optionPool / totalPool) * 100 : 0;
          const cents = Math.round((totalPool > 0 ? optionPool / totalPool : 1 / options.length) * 100);

          return (
            <View key={option.id} style={styles.optionWrapper}>
              <TouchableOpacity
                testID={
                  option.label?.toLowerCase().trim() === "yes"
                    ? "bet-side-yes"
                    : option.label?.toLowerCase().trim() === "no"
                      ? "bet-side-no"
                      : undefined
                }
                style={[
                  styles.optionPill,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8F9FA', borderColor: theme.border, borderWidth: 1 },
                  isWinner && { borderColor: theme.primary, borderWidth: 1.5, backgroundColor: isDark ? 'rgba(0, 122, 255, 0.1)' : '#E3F2FD' }
                ]}
                onPress={() => !isResolved && onSelectOption?.(option.id, "yes")}
                disabled={isResolved}
              >
                <View style={[styles.optionProgress, { width: `${percent}%`, backgroundColor: isWinner ? theme.primary : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)') }]} />
                <View style={styles.optionContent}>
                  <Text style={[styles.optionLabel, { color: theme.text }, isWinner && { fontWeight: '600' }]}>
                    {option.label}
                  </Text>
                  <View style={styles.optionMetrics}>
                    {!isResolved && <Text style={[styles.optionCents, { color: theme.primary }]}>{cents}¢</Text>}
                    <Text style={[styles.optionPercent, { color: isWinner ? theme.primary : theme.textSecondary }]}>
                      {Math.round(percent)}%
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
              {canResolve && !isResolved && (
                <TouchableOpacity style={[styles.adminAction, { marginTop: 4 }]} onPress={() => onResolve?.(option.id)}>
                  <Text style={[styles.adminActionText, { color: theme.primary }]}>MARK AS WINNER</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <View style={styles.volumeContainer}>
          <Text style={[styles.volumeLabel, { color: theme.textSecondary }]}>Pool</Text>
          <Text style={[styles.volumeValue, { color: theme.text }]}>{formatCurrency(totalPool)}</Text>
        </View>
        <TouchableOpacity style={[styles.chartToggle, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F3F7F4" }]} onPress={onViewDistribution}>
          <IconSymbol name="chart.bar.fill" size={14} color={theme.primary} />
          <Text style={[styles.chartLink, { color: theme.primary }]}>Stats</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 4,
  },
  compactContainer: {
    padding: 12,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.45,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerText: {
    fontSize: 11,
    fontWeight: '600',
  },
  question: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
    marginBottom: 14,
    letterSpacing: -0.5,
  },
  imageWrapper: {
    width: '100%',
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  binaryContainer: {
    gap: 12,
  },
  binaryButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  predictButton: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  loader: {
    padding: 20,
    alignItems: 'center',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  likeCount: {
    fontSize: 13,
    fontWeight: '400',
  },
  predictLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  predictPrice: {
    fontSize: 18,
    fontWeight: '600',
  },
  optionWrapper: {
    width: '100%',
  },
  optionPill: {
    height: 46,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    position: 'relative',
  },
  optionProgress: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    opacity: 0.1,
  },
  optionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '400',
    flex: 1,
    marginRight: 10,
  },
  optionMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionCents: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionPercent: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  resolveRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  adminAction: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  adminActionText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(142, 142, 147, 0.2)',
  },
  volumeContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  volumeLabel: {
    fontSize: 12,
    fontWeight: '400',
  },
  volumeValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  chartToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  chartLink: {
    fontSize: 13,
    fontWeight: '600',
  },
  likedText: {
    color: '#FF2D55',
  }
});

function LikeButton({ marketId, isDark, theme }: { marketId: string, isDark: boolean, theme: any }) {
  const { liked, count, toggleLike } = useMarketLikes(marketId);

  return (
    <TouchableOpacity 
      onPress={toggleLike} 
      style={styles.likeButton}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons 
        name={liked ? "heart" : "heart-outline"} 
        size={20} 
        color={liked ? "#FF2D55" : theme.textSecondary} 
      />
      {count > 0 && (
        <Text style={[styles.likeCount, { color: liked ? "#FF2D55" : theme.textSecondary }]}>
          {count}
        </Text>
      )}
    </TouchableOpacity>
  );
}
