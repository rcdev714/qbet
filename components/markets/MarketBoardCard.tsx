import { FeedTradingPanel, type FeedTradeParams } from "@/components/feed/FeedTradingPanel";
import { ShareToGroupModal } from "@/components/ShareToGroupModal";
import { SocialProofStrip } from "@/components/social/SocialProofStrip";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useWalletContext } from "@/contexts/WalletContext";
import { useElementVisibility } from "@/hooks/useElementVisibility";
import { usePremiumNavigation } from "@/hooks/usePremiumNavigation";
import { alertBetPlacedWithContract } from "@/lib/bet-contract-ui";
import { formatCurrency } from "@/lib/parimutuel";
import { showAppAlertRaw } from "@/lib/ui/feedback";
import { betService } from "@/services/bet.service";
import { feedService } from "@/services/feed.service";
import { likeService } from "@/services/like.service";
import { socialService, type MarketSocialProof } from "@/services/social.service";
import type { Market, MarketWithStats } from "@/types/market";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    type ViewStyle,
} from "react-native";

function getMarketTimeLabel(
  closesAt: string | null,
  t: (key: string, opts?: Record<string, unknown>) => string,
) {
  if (!closesAt) return t("noCloseDate");
  const closeDate = new Date(closesAt);
  if (Number.isNaN(closeDate.getTime())) return t("noCloseDate");

  const diff = closeDate.getTime() - Date.now();
  if (diff <= 0) return t("closed");

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return t("daysHoursLeft", { days, hours });
  if (hours > 0) return t("hoursLeft", { hours });
  return t("closingSoon");
}

function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(count);
}

export interface MarketBoardCardProps {
  market: Market;
  columnWidth?: string;
}

export function MarketBoardCard({ market, columnWidth }: MarketBoardCardProps) {
  const { navigate } = usePremiumNavigation();
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useAuthContext();
  const { isPlayMode, balance } = useWalletContext();
  const { t } = useTranslation("feed");
  const { ref: visibilityRef, isVisible } = useElementVisibility(0.4);
  const viewStartTime = useRef<number | null>(null);

  const [stats, setStats] = useState<MarketWithStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [previewAmount, setPreviewAmount] = useState("25");
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const [showGroupShareModal, setShowGroupShareModal] = useState(false);
  const [socialProof, setSocialProof] = useState<MarketSocialProof | null>(null);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const nextStats = await feedService.getMarketWithStats(market.id);
      setStats(nextStats);
    } catch (error) {
      console.error("Failed to load market stats", error);
    } finally {
      setStatsLoading(false);
    }
  }, [market.id]);

  useEffect(() => {
    if (isVisible) loadStats();
  }, [isVisible, loadStats]);

  useEffect(() => {
    if (!isVisible || !user) return;
    socialService.getMarketSocialProof(market.id).then(setSocialProof);
  }, [isVisible, market.id, user]);

  useEffect(() => {
    if (!isVisible || !user) return;
    let mounted = true;
    const loadSocial = async () => {
      try {
        const [socialStats, liked] = await Promise.all([
          likeService.getSocialStats(market.id),
          likeService.hasLiked(market.id),
        ]);
        if (mounted) {
          setLikeCount(socialStats.likeCount);
          setCommentCount(socialStats.commentCount);
          setIsLiked(liked);
        }
      } catch {
        /* non-fatal */
      }
    };
    loadSocial();
    return () => {
      mounted = false;
    };
  }, [isVisible, market.id, user]);

  useEffect(() => {
    if (isVisible && user?.id) viewStartTime.current = Date.now();
    else if (!isVisible && viewStartTime.current && user?.id) {
      const duration = Date.now() - viewStartTime.current;
      if (duration > 500) {
        void feedService.trackEngagement(user.id, market.id, market.category || null, duration);
      }
      viewStartTime.current = null;
    }
    return () => {
      if (viewStartTime.current && user?.id) {
        const duration = Date.now() - viewStartTime.current;
        if (duration > 500) {
          void feedService.trackEngagement(user.id, market.id, market.category || null, duration);
        }
      }
    };
  }, [isVisible, user?.id, market.id, market.category]);

  const openMarket = () =>
    navigate(`/market/${market.id}`, { message: "Preparing the market..." });

  const openComments = () => {
    navigate(
      { pathname: "/market/[id]", params: { id: market.id, tab: "chat" } } as any,
      { message: "Opening live chat..." },
    );
  };

  const handleLike = async () => {
    if (!user) {
      showAppAlertRaw("Sign in required", "Please sign in to like markets.");
      return;
    }
    if (isLiking) return;
    setIsLiking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount((prev) => (wasLiked ? Math.max(0, prev - 1) : prev + 1));
    const { liked, count, error } = await likeService.toggleLike(market.id);
    if (error) {
      setIsLiked(wasLiked);
      setLikeCount((prev) => (wasLiked ? prev + 1 : Math.max(0, prev - 1)));
    } else {
      setIsLiked(liked);
      setLikeCount(count);
    }
    setIsLiking(false);
  };

  const handleTrade = async ({ side, optionId, amount }: FeedTradeParams) => {
    if (!user) {
      showAppAlertRaw("Sign in required", "Please sign in to place a bet.");
      return;
    }
    const stake = amount ?? parseFloat(previewAmount);
    if (!Number.isFinite(stake) || stake <= 0) {
      showAppAlertRaw("Enter amount", "Choose a stake before placing your bet.");
      return;
    }
    if (stake > balance) {
      showAppAlertRaw("Insufficient balance", "You don't have enough funds for this bet.");
      return;
    }

    setTradeLoading(true);
    try {
      const { bet, error, contractPipeline } = await betService.placeBet({
        marketId: market.id,
        optionId,
        amount: stake,
        side,
        isPlayMode,
      });
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      alertBetPlacedWithContract({
        router,
        betId: bet?.id,
        isPlayMode,
        contractPipeline,
      });
      await loadStats();
    } catch (err) {
      showAppAlertRaw("Bet failed", err instanceof Error ? err.message : "Could not place bet.");
    } finally {
      setTradeLoading(false);
    }
  };

  const cardWidthStyle =
    Platform.OS === "web" && columnWidth
      ? ({ width: columnWidth, maxWidth: columnWidth } as unknown as ViewStyle)
      : undefined;

  const pool = stats?.totalPool ?? 0;

  return (
    <>
      <View
        ref={visibilityRef as React.RefObject<View>}
        style={[
          styles.card,
          cardWidthStyle,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: theme.radius.lg,
          },
        ]}
      >
        <TouchableOpacity onPress={openMarket} activeOpacity={0.85}>
          <Text style={[styles.question, { color: theme.text }]} numberOfLines={2}>
            {market.question}
          </Text>
        </TouchableOpacity>

        <SocialProofStrip proof={socialProof} />

        <FeedTradingPanel
          market={market}
          stats={stats}
          variant="surface"
          selectedOptionId={selectedOptionId}
          onSelectOption={setSelectedOptionId}
          previewAmount={previewAmount}
          onPreviewAmountChange={setPreviewAmount}
          onTrade={handleTrade}
          isPlayMode={isPlayMode}
          loading={statsLoading || tradeLoading}
        />

        {statsLoading && !stats ? (
          <View style={styles.statsLoading}>
            <ActivityIndicator size="small" color={theme.primary} />
          </View>
        ) : null}

        <View style={styles.socialRow}>
          <TouchableOpacity style={styles.socialButton} onPress={handleLike} disabled={isLiking}>
            <IconSymbol
              name={isLiked ? "heart.fill" : "heart"}
              size={18}
              color={isLiked ? theme.error : theme.textSecondary}
            />
            <Text style={[styles.socialCount, { color: theme.textSecondary }]}>
              {formatCount(likeCount)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialButton} onPress={openComments}>
            <IconSymbol name="message" size={18} color={theme.textSecondary} />
            <Text style={[styles.socialCount, { color: theme.textSecondary }]}>
              {formatCount(commentCount)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => {
              if (!user) {
                showAppAlertRaw("Sign in required", "Please sign in to share to a group.");
                return;
              }
              setShowGroupShareModal(true);
            }}
          >
            <IconSymbol name="paperplane" size={18} color={theme.textSecondary} />
            <Text style={[styles.socialCount, { color: theme.textSecondary }]}>Share</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <Text style={[styles.footerMetric, { color: theme.textSecondary }]}>
            Vol {formatCurrency(pool)}
          </Text>
          <Text style={[styles.footerMetric, { color: theme.textSecondary }]}>
            {getMarketTimeLabel(market.closes_at, t)}
          </Text>
        </View>
      </View>

      <ShareToGroupModal
        visible={showGroupShareModal}
        onClose={() => setShowGroupShareModal(false)}
        marketId={market.id}
        marketQuestion={market.question}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 0,
    flexShrink: 0,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 10,
  },
  question: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "500",
    letterSpacing: -0.3,
    minHeight: 42,
  },
  statsLoading: {
    alignItems: "center",
    paddingVertical: 4,
  },
  socialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
  },
  socialCount: {
    fontSize: 13,
    fontWeight: "500",
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerMetric: {
    fontSize: 11,
    fontWeight: "500",
  },
});
