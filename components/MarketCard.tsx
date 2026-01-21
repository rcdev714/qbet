import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { calculateImpliedOdds, formatCurrency, formatProbability } from "../lib/parimutuel";
import type { Market, MarketOption } from "../types/market";

interface MarketCardProps {
  market: Market;
  options: MarketOption[];
  onSelectOption?: (optionId: string) => void;
  onResolve?: (optionId: string) => void;
  onViewDistribution?: () => void;
  compact?: boolean;
  canResolve?: boolean;
}

export function MarketCard({
  market,
  options,
  onSelectOption,
  onResolve,
  onViewDistribution,
  compact = false,
  canResolve = false
}: MarketCardProps) {
  const { theme, isDark } = useTheme();
  const [timeLeft, setTimeLeft] = useState<string>("");
  const totalPool = options.reduce((sum, opt) => sum + Number(opt.total_pool), 0);
  const impliedOdds = calculateImpliedOdds(options);

  useEffect(() => {
    if (market.status !== 'open' || !market.closes_at) {
      setTimeLeft("");
      return;
    }

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(market.closes_at!).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("Closed");
        clearInterval(timer);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        if (hours > 24) {
          setTimeLeft(`${Math.floor(hours / 24)}d left`);
        } else {
          setTimeLeft(`${hours}h ${mins}m ${secs}s`);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [market.closes_at, market.status]);

  const isResolved = market.status === 'resolved';

  const formatTimeLeft = (time: string) => {
    if (!time) return "";
    return time.replace(" left", "");
  };

  return (
    <View style={[
      styles.container,
      { backgroundColor: theme.surface, borderColor: theme.border },
      compact && styles.compactContainer,
      isResolved && { backgroundColor: isDark ? theme.surface : '#F8F9FA', borderColor: theme.border }
    ]}>
      <View style={styles.header}>
        <View style={styles.questionRow}>
          <Text style={[styles.question, { color: theme.text }]} numberOfLines={compact ? 2 : undefined}>
            {market.question}
          </Text>
          {timeLeft !== "" && (
            <View style={[styles.timerBadge, { backgroundColor: isDark ? theme.background : "#F8F9FA", borderColor: theme.border }]}>
              <Text style={styles.timerText}>{formatTimeLeft(timeLeft)} left</Text>
            </View>
          )}
        </View>
        {isResolved && (
          <View style={[styles.resolvedBadge, { backgroundColor: isDark ? theme.background : "#F0F2F5" }]}>
            <Text style={[styles.resolvedBadgeText, { color: theme.textSecondary }]}>RESOLVED</Text>
          </View>
        )}
      </View>
      {market.image_url && (
        <Image
          source={{ uri: market.image_url }}
          style={styles.bannerImage}
          contentFit="cover"
          transition={200}
        />
      )}

      <View style={styles.optionsContainer}>
        {options.map((option) => {
          const odds = impliedOdds.find((o) => o.optionId === option.id);
          const probability = odds ? formatProbability(odds.probability) : "0%";
          const isWinner = market.winning_option_id === option.id;

          return (
            <View key={option.id} style={styles.optionWrapper}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  isWinner && { borderColor: theme.primary, borderWidth: 2 },
                  isResolved && !isWinner && { opacity: 0.6, backgroundColor: isDark ? theme.surface : '#F8F9FA' }
                ]}
                onPress={() => !isResolved && onSelectOption?.(option.id)}
                disabled={isResolved}
                activeOpacity={0.7}
              >
                <View style={styles.optionInfo}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.optionLabel, { color: theme.text }, isWinner && { color: theme.primary, fontWeight: '700' }]}>
                      {option.label}
                    </Text>
                    {isWinner && <View style={[styles.winnerDot, { backgroundColor: theme.primary }]} />}
                  </View>
                  <Text style={[styles.optionProbability, isWinner && { color: theme.primary, fontWeight: "700" }]}>
                    {probability}
                  </Text>
                </View>
                {!isResolved && (
                  <View style={[
                    styles.probabilityBar,
                    { width: odds ? `${odds.probability * 100}%` : "0%", backgroundColor: theme.primary }
                  ]} />
                )}
              </TouchableOpacity>


              {canResolve && !isResolved && (
                <TouchableOpacity
                  style={styles.resolveBtn}
                  onPress={() => onResolve?.(option.id)}
                >
                  <Text style={styles.resolveBtnText}>SET AS RESULT</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.metaInfo}
          onPress={onViewDistribution}
          activeOpacity={onViewDistribution ? 0.7 : 1}
        >
          <Text style={styles.metaLabel}>Vol.</Text>
          <Text style={[styles.metaValue, { color: theme.text }]}>{formatCurrency(totalPool)}</Text>
          {onViewDistribution && <View style={styles.arrow} />}
        </TouchableOpacity>
        <Text style={[
          styles.statusBadge,
          market.status === 'open' ? [styles.statusOpen, { color: theme.primary }] : [styles.statusClosed, { color: theme.textSecondary }]
        ]}>
          {(market.status || 'open').toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#C6C6C8",
    width: '100%',
  },
  bannerImage: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    marginBottom: 12,
  },
  resolvedContainer: {
    backgroundColor: '#F8F9FA',
    borderColor: '#E9ECEF',
  },
  compactContainer: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 0, // Remove border for cleaner look inside list
    backgroundColor: "transparent", // Let the bubble background show or handle itself
  },
  header: {
    marginBottom: 12,
  },
  questionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  question: {
    flex: 1,
    fontSize: 16, // Smaller for chat
    fontWeight: "700",
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  timerBadge: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0,
  },
  timerText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
  },
  resolvedBadge: {
    backgroundColor: '#F0F2F5',
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  resolvedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 0.5,
  },
  optionsContainer: {
    gap: 8,
    marginBottom: 12,
  },
  optionWrapper: {
    gap: 4,
  },
  optionButton: {
    backgroundColor: "rgba(0,0,0,0.03)", // Very subtle for chat options
    borderRadius: 100,
    height: 44, // Slightly smaller
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  winnerButton: {
    backgroundColor: '#fff',
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  disabledButton: {
    opacity: 0.6,
    backgroundColor: '#F8F9FA',
  },
  optionInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    zIndex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  winnerLabel: {
    color: '#007AFF',
    fontWeight: '700',
  },
  winnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
  },
  // Removed winnerCheck style
  optionProbability: {
    fontSize: 15,
    fontWeight: "600",
    color: "#8E8E93",
  },
  winnerProb: {
    color: '#007AFF',
    fontWeight: "700",
  },
  probabilityBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#007AFF",
    opacity: 0.08,
  },
  resolveBtn: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF', // Blue
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  resolveBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500', // Non-bold
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#C6C6C8",
  },
  metaInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaLabel: {
    fontSize: 13,
    color: "#8E8E93",
    fontWeight: "500",
  },
  metaValue: {
    fontSize: 13,
    color: "#1A1A1A",
    fontWeight: "600",
  },
  arrow: {
    width: 6,
    height: 6,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: "#007AFF",
    transform: [{ rotate: "45deg" }],
  },
  // Removed viewLink style
  statusBadge: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  statusOpen: {
    color: "#007AFF",
  },
  statusClosed: {
    color: "#8E8E93",
  },
});

