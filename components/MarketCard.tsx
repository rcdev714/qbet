import { AppButton, AppIconButton, AppText } from "@/components/ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useMarketLikes } from "@/hooks/useMarketLikes";
import { useTheme } from "@/contexts/ThemeContext";
import { getBinaryOptions, isBinaryMarket } from "@/lib/market-utils";
import { formatCurrency } from "@/lib/parimutuel";
import type { Market, MarketOption } from "@/types/market";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

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
      theme.elevation('md'),
      {
        backgroundColor: theme.surface,
        borderColor: theme.border,
        shadowOpacity: isDark ? 0.26 : 0.1,
        borderRadius: theme.radius.xl,
      },
      compact && styles.compactContainer,
      isResolved && { opacity: 0.95 }
    ]}>
      <View style={styles.topRow}>
        <View style={styles.badgeRow}>
          <View style={[
            styles.statusBadge,
            {
              backgroundColor: market.status === 'open' ? theme.primarySoft : (isDark ? theme.borderSubtle : theme.muted),
              borderRadius: theme.radius.pill,
            },
          ]}>
            <View style={[
              styles.statusDot,
              {
                backgroundColor: market.status === 'open' ? theme.primary : theme.textSecondary,
                borderRadius: theme.radius.pill,
              },
            ]} />
            <AppText
              variant="caption"
              color={market.status === 'open' ? 'primary' : 'secondary'}
              style={{ letterSpacing: 0.5, textTransform: 'uppercase' }}
            >
              {(market.status || 'open').toUpperCase()}
            </AppText>
          </View>
          {isShared && (
            <View style={[
              styles.statusBadge,
              {
                backgroundColor: isDark ? `${theme.success}26` : theme.primarySoft,
                borderRadius: theme.radius.pill,
              },
            ]}>
              <AppText variant="caption" color="success" style={{ letterSpacing: 0.5, textTransform: 'uppercase' }}>
                PUBLIC
              </AppText>
            </View>
          )}
        </View>
        <LikeButton marketId={market.id} theme={theme} />
      </View>

      <View style={styles.metaRow}>
        <AppText variant="caption" color="secondary" numberOfLines={1}>
          {market.category || "General"}
        </AppText>
        <View style={[styles.metaDot, { backgroundColor: theme.textSecondary, borderRadius: theme.radius.pill }]} />
        <AppText variant="caption" color="secondary" numberOfLines={1}>
          Closes {formatCloseTime(market.closes_at)}
        </AppText>
      </View>

      <TouchableOpacity activeOpacity={0.9} onPress={onViewDistribution} disabled={!onViewDistribution}>
        <AppText variant="title1" numberOfLines={compact ? 3 : undefined} style={{ marginBottom: 14, letterSpacing: -0.5 }}>
          {market.question}
        </AppText>
      </TouchableOpacity>

      {market.image_url && (
        <View style={[styles.imageWrapper, { borderRadius: theme.radius.md }]}>
          <Image
            source={{ uri: market.image_url }}
            style={styles.bannerImage}
            contentFit="cover"
            transition={300}
          />
          <LinearGradient
            colors={['transparent', theme.overlay]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}

      <View style={styles.optionsContainer}>
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
                <AppButton
                  testID="bet-side-yes"
                  title={`YES ${yesCents}¢`}
                  variant="secondary"
                  size="sm"
                  onPress={() => onSelectOption?.(yesOption.id, "yes")}
                  style={{
                    flex: 1,
                    backgroundColor: theme.primarySoft,
                    borderColor: theme.primary,
                  }}
                />
                <AppButton
                  title={`NO ${noCents}¢`}
                  variant="destructive"
                  size="sm"
                  onPress={() => onSelectOption?.(noOption.id, "no")}
                  style={{ flex: 1 }}
                />
              </View>
              {canResolve && (
                <View style={styles.resolveRow}>
                  <AppButton
                    title="WIN YES"
                    variant="ghost"
                    size="sm"
                    onPress={() => onResolve?.(yesOption.id)}
                  />
                  <AppButton
                    title="WIN NO"
                    variant="ghost"
                    size="sm"
                    onPress={() => onResolve?.(noOption.id)}
                  />
                </View>
              )}
            </View>
          );
        })()}

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
                  {
                    backgroundColor: isDark ? theme.borderSubtle : theme.muted,
                    borderColor: theme.border,
                    borderRadius: theme.radius.md,
                  },
                  isWinner && { borderColor: theme.primary, borderWidth: 1.5, backgroundColor: theme.primarySoft }
                ]}
                onPress={() => !isResolved && onSelectOption?.(option.id, "yes")}
                disabled={isResolved}
              >
                <View style={[styles.optionProgress, {
                  width: `${percent}%`,
                  backgroundColor: isWinner ? theme.primary : (isDark ? theme.borderSubtle : theme.muted),
                }]} />
                <View style={styles.optionContent}>
                  <AppText variant="body" numberOfLines={1} style={{ flex: 1, marginRight: 10 }}>
                    {option.label}
                  </AppText>
                  <View style={styles.optionMetrics}>
                    {!isResolved && (
                      <AppText variant="bodySm" color="primary">{cents}¢</AppText>
                    )}
                    <AppText
                      variant="bodySm"
                      color={isWinner ? 'primary' : 'secondary'}
                      style={{ minWidth: 40, textAlign: 'right' }}
                    >
                      {Math.round(percent)}%
                    </AppText>
                  </View>
                </View>
              </TouchableOpacity>
              {canResolve && !isResolved && (
                <AppButton
                  title="MARK AS WINNER"
                  variant="ghost"
                  size="sm"
                  onPress={() => onResolve?.(option.id)}
                  style={{ marginTop: 4, alignSelf: 'flex-end' }}
                />
              )}
            </View>
          );
        })}
      </View>

      <View style={[styles.footer, { borderTopColor: theme.borderSubtle }]}>
        <View style={styles.volumeContainer}>
          <AppText variant="caption" color="secondary">Pool</AppText>
          <AppText variant="bodySm">{formatCurrency(totalPool)}</AppText>
        </View>
        <AppButton
          title="Stats"
          variant="secondary"
          size="sm"
          icon={<IconSymbol name="chart.bar.fill" size={14} color={theme.primary} />}
          onPress={onViewDistribution}
          style={{ backgroundColor: isDark ? theme.borderSubtle : theme.muted, borderWidth: 0 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 18,
    borderWidth: 1,
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
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  metaDot: {
    width: 3,
    height: 3,
    opacity: 0.45,
  },
  imageWrapper: {
    width: '100%',
    height: 140,
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
  optionWrapper: {
    width: '100%',
  },
  optionPill: {
    height: 46,
    overflow: 'hidden',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
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
  optionMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resolveRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  volumeContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
});

function LikeButton({ marketId, theme }: { marketId: string; theme: ReturnType<typeof useTheme>["theme"] }) {
  const { liked, count, toggleLike } = useMarketLikes(marketId);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <AppIconButton
        accessibilityLabel={liked ? "Unlike market" : "Like market"}
        variant="ghost"
        onPress={toggleLike}
        icon={
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={20}
            color={liked ? theme.destructive : theme.textSecondary}
          />
        }
        style={{ width: 36, height: 36 }}
      />
      {count > 0 && (
        <AppText variant="label" color={liked ? 'destructive' : 'secondary'}>
          {count}
        </AppText>
      )}
    </View>
  );
}
