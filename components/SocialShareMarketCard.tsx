import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/ThemeContext";
import { useMarketLikes } from "@/hooks/useMarketLikes";
import { getBinaryOptions, isBinaryMarket } from "@/lib/market-utils";
import type { Market, MarketWithStats } from "@/types/market";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
    Dimensions,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";

interface SocialShareMarketCardProps {
  market: Market;
  stats?: MarketWithStats | null;
  onClose?: () => void;
  onShare?: () => void;
  onShareToGroup?: () => void;
  onPredict?: () => void;
  inline?: boolean;
}

const { width: windowWidth } = Dimensions.get("window");
// Default sizes for Overlay mode
const OVERLAY_CARD_WIDTH = Math.min(windowWidth * 0.85, 380);
const OVERLAY_CARD_HEIGHT = OVERLAY_CARD_WIDTH * 1.5; // Taller for better proportion

export function SocialShareMarketCard({
  market,
  stats,
  onClose,
  onShare,
  onShareToGroup,
  onPredict,
  inline = false,
}: SocialShareMarketCardProps) {
  const { theme } = useTheme();
  const hasImage = Boolean(market.image_url);

  // Determine if binary or multi
  const isBinary = stats ? isBinaryMarket(market, stats.optionStats) : false;
  const binaryOptions =
    isBinary && stats ? getBinaryOptions(stats.optionStats) : null;

  // Top 3 options for multi-choice
  const topOptions = stats?.optionStats
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 3);

  const content = (
    <View
      style={[
        styles.card,
        !hasImage && { backgroundColor: theme.surface, borderColor: theme.border },
        inline && styles.inlineCard,
        inline && !hasImage && styles.inlineCardNoImage,
      ]}
    >
      {/* Full Bleed Background Image */}
      {hasImage && (
      <View style={styles.imageContainer}>
        {market.image_url ? (
          <Image
            source={{ uri: market.image_url }}
            style={styles.backgroundImage}
            contentFit="cover"
            transition={300}
          />
        ) : null}
        
        <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.8)', '#000']}
            locations={[0, 0.4, 0.7, 1]}
            style={styles.gradientOverlay}
        />
      </View>
      )}

      {/* Top Badges */}
      <View style={[styles.topControls, inline && styles.inlineTopControls]}>
         <View style={styles.badgeContainer}>
            <View style={[styles.badge, styles.liveBadge]}>
               <View style={styles.liveDot} />
               <Text style={styles.badgeText}>LIVE</Text>
            </View>
            <View style={[styles.badge, styles.glassBadge]}>
               <IconSymbol name="sparkles" size={10} color={hasImage ? "#fff" : theme.primary} />
               <Text style={[styles.badgeText, !hasImage && { color: theme.primary }]}>ANYMARKET</Text>
            </View>
            {inline && <LikeButton marketId={market.id} theme={theme} />}
         </View>
      </View>

      {/* Content Overlay */}
      <View style={[styles.contentOverlay, inline && styles.inlineContentOverlay]}>
        <View style={[styles.mainContent, inline && styles.inlineMainContent]}>
            <View style={styles.metadataRow}>
                <View style={[styles.metadataContainer, !hasImage && styles.metadataContainerNoImage]}>
                    <Text style={[styles.categoryText, { color: hasImage ? "#fff" : theme.text }]}>{market.category || "General"}</Text>
                    {stats && (
                        <>
                            <View style={styles.divider} />
                            <IconSymbol name="dollarsign.circle.fill" size={12} color={hasImage ? "#fff" : theme.textSecondary} />
                            <Text style={[styles.statText, { color: hasImage ? "#fff" : theme.textSecondary }]}>${stats.totalPool.toLocaleString()}</Text>
                        </>
                    )}
                </View>
            </View>

            <Text style={[styles.question, { color: hasImage ? "#fff" : theme.text }, inline && styles.inlineQuestion]} numberOfLines={inline ? 2 : 3}>
              {market.question}
            </Text>

            <View style={styles.statsContainer}>
              {!stats ? (
                 <View style={styles.loadingStats}>
                    <View style={[styles.skeletonBar, { width: '60%' }]} />
                    <View style={[styles.skeletonBar, { width: '40%' }]} />
                 </View>
              ) : isBinary && binaryOptions ? (
                <View style={styles.binaryGraph}>
                  <View style={styles.binaryLabels}>
                    <Text style={[styles.optionLabel, { color: theme.primary }]}>
                      Yes {Math.round(binaryOptions.yesOption.percentage)}%
                    </Text>
                    <Text style={[styles.optionLabel, { color: "#FF453A" }]}>
                      No {Math.round(binaryOptions.noOption.percentage)}%
                    </Text>
                  </View>
                  <View style={styles.binaryBarContainer}>
                    <View style={[styles.binaryBarSegment, { backgroundColor: theme.primary, flex: binaryOptions.yesOption.percentage || 1 }]} />
                    <View style={[styles.binaryBarSegment, { backgroundColor: "#FF453A", flex: binaryOptions.noOption.percentage || 1 }]} />
                  </View>
                </View>
              ) : (
                <View style={styles.multiList}>
                  {topOptions?.map((opt, i) => (
                    <View key={opt.optionId} style={styles.multiRow}>
                      <View style={styles.multiRowContent}>
                         <Text style={[styles.multiLabel, { color: hasImage ? "#fff" : theme.text }]} numberOfLines={1}>{opt.label}</Text>
                         <Text style={[styles.multiPercent, { color: hasImage ? "rgba(255,255,255,0.7)" : theme.textSecondary }]}>{Math.round(opt.percentage)}%</Text>
                      </View>
                      <View style={[styles.multiBarBg, !hasImage && { backgroundColor: "rgba(142,142,147,0.22)" }]}>
                        <View style={[styles.multiBarFill, { width: `${opt.percentage}%`, backgroundColor: i === 0 ? theme.primary : (hasImage ? 'rgba(255,255,255,0.3)' : "rgba(142,142,147,0.45)") }]} />
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
        </View>

        <View style={[styles.footer, inline && styles.inlineFooter]}>
            {!inline && <Text style={[styles.shareTitle, { color: hasImage ? "rgba(255,255,255,0.5)" : theme.textSecondary }]}>Scan or tap to predict</Text>}
            <View style={styles.actionRow}>
                <TouchableOpacity
                    style={[styles.actionButton, inline && styles.inlineActionButton, { backgroundColor: theme.primary }]}
                    onPress={onPredict || onShare}
                >
                    <Text style={[styles.actionText, { color: theme.onPrimary }]}>{inline || onPredict ? "Open Market" : "Wait, Share Link"}</Text>
                </TouchableOpacity>
                
                {onShareToGroup && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.secondaryButton]}
                        onPress={onShareToGroup}
                    >
                        <IconSymbol name="person.2.fill" size={16} color="#fff" />
                        <Text style={styles.actionText}>To Group</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>

        {/* Close Button */}
        {!inline && onClose && (
            <TouchableOpacity 
                style={styles.closeButton} 
                onPress={onClose}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
                <BlurView intensity={30} tint="dark" style={styles.closeButtonBlur}>
                    <IconSymbol name="xmark" size={16} color="#fff" />
                </BlurView>
            </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (inline) {
    return content;
  }

  return (
    <View style={styles.overlay}>
      {Platform.OS !== "web" && (
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      )}
      {Platform.OS === "web" && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)" } as any]} />
      )}

      <Animated.View 
        entering={SlideInDown.springify().damping(18)} 
        style={styles.container}
      >
        {content}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  card: {
    width: OVERLAY_CARD_WIDTH,
    height: OVERLAY_CARD_HEIGHT,
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    position: 'relative',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 20,
  },
  inlineCard: {
    width: '100%',
    maxWidth: 680,
    height: undefined,
    aspectRatio: 1.55,
    alignSelf: 'flex-start',
    borderRadius: 24,
    borderWidth: 1,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 3,
  },
  inlineCardNoImage: {
    aspectRatio: undefined,
    minHeight: 280,
  },
  imageContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  backgroundImage: {
    width: "100%",
    height: "100%",
    opacity: 0.8,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  topControls: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    zIndex: 10,
  },
  inlineTopControls: {
    top: 16,
    left: 16,
    right: 16,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 16,
    gap: 5,
  },
  liveBadge: {
    backgroundColor: '#FF3B30',
  },
  glassBadge: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  contentOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 24,
    zIndex: 1,
  },
  inlineContentOverlay: {
    padding: 18,
  },
  mainContent: {
    marginBottom: 20,
  },
  inlineMainContent: {
    marginBottom: 14,
  },
  metadataRow: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  metadataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,30,30,0.6)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 6,
  },
  metadataContainerNoImage: {
    backgroundColor: "rgba(142,142,147,0.12)",
    borderColor: "rgba(142,142,147,0.2)",
  },
  categoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  statText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '400',
  },
  divider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  question: {
    color: "#fff",
    fontSize: 24,
    fontWeight: '400',
    lineHeight: 30,
    letterSpacing: -0.5,
    marginBottom: 20,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  inlineQuestion: {
    fontSize: 22,
    lineHeight: 27,
    marginBottom: 14,
  },
  statsContainer: {
    marginBottom: 8,
  },
  loadingStats: {
     gap: 12,
  },
  skeletonBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 8,
  },
  binaryGraph: {
    gap: 8,
  },
  binaryLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  binaryBarContainer: {
    flexDirection: "row",
    height: 14,
    borderRadius: 7,
    overflow: "hidden",
    gap: 3,
  },
  binaryBarSegment: {
    height: "100%",
  },
  multiList: {
    gap: 10,
  },
  multiRow: {
    gap: 6,
  },
  multiRowContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  multiLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: '400',
    maxWidth: '80%',
  },
  multiPercent: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontWeight: '400',
  },
  multiBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  multiBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  footer: {
    gap: 16,
  },
  inlineFooter: {
    gap: 10,
  },
  shareTitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: '400',
    textTransform: "uppercase",
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 24,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  inlineActionButton: {
    paddingVertical: 13,
    borderRadius: 18,
  },
  secondaryButton: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  actionText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  closeButton: {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 10,
  },
  closeButtonBlur: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  likeCount: {
    fontSize: 12,
    fontWeight: '400',
  },
});

function LikeButton({ marketId, theme }: { marketId: string, theme: any }) {
  const { liked, count, toggleLike } = useMarketLikes(marketId);

  return (
    <TouchableOpacity 
      onPress={toggleLike} 
      style={styles.likeButton}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons 
        name={liked ? "heart" : "heart-outline"} 
        size={18} 
        color={liked ? "#FF2D55" : "#fff"} 
      />
      {count > 0 && (
        <Text style={[styles.likeCount, { color: liked ? "#FF2D55" : "#fff" }]}>
          {count}
        </Text>
      )}
    </TouchableOpacity>
  );
}

