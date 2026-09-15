import { MentionMessage } from "@/components/chat/MentionMessage";
import { FeedTradingPanel } from "@/components/feed/FeedTradingPanel";
import { ChatComposer } from "@/components/group-chat/ChatComposer";
import { ReportContentButton } from "@/components/moderation/ReportContentButton";
import { SocialShareMarketCard } from "@/components/SocialShareMarketCard";
import { Brand } from "@/constants/theme";
import { CHAT_LIST_PADDING_TOP, CHAT_LIST_PADDING_X } from "@/constants/layout";
import { useTheme } from "@/contexts/ThemeContext";
import { useMarket } from "@/hooks/useMarket";
import { getRandomColor } from "@/lib/colors";
import { marketService } from "@/services/market.service";
import type { Market } from "@/types/market";
import type { MentionEmbedPayload } from "@/types/mention";
import type { Message } from "@/types/message";
import { Image } from "expo-image";
import { Router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";

// ─── Sub-component: Market embedded in chat ────────────────────────────────
function MarketMessage({
  marketId,
  router,
  onBet,
  onResolve,
  isAdmin,
  refreshTrigger,
  isShared,
  currentUserId,
}: {
  marketId: string;
  router: Router;
  onBet: (market: Market, optionId: string, side: "yes" | "no") => void;
  onResolve: (marketId: string, optionId: string) => void;
  isAdmin?: boolean;
  refreshTrigger?: number;
  isShared?: boolean;
  currentUserId?: string;
}) {
  const [stats, setStats] = React.useState<any | null>(null);
  const { market, loading, refresh } = useMarket(marketId);

  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) refresh();
  }, [refreshTrigger, refresh]);

  useEffect(() => {
    let mounted = true;
    if (marketId) {
      marketService.getMarketWithStats(marketId).then((data) => {
        if (mounted && data) setStats(data);
      });
    }
    return () => { mounted = false; };
  }, [marketId, refreshTrigger]);

  if (loading) return <ActivityIndicator size="small" color="#999" style={{ margin: 20 }} />;
  if (!market) {
    return (
      <View style={styles.errorCard}>
        <Text style={styles.errorCardText}>Could not load this prediction.</Text>
      </View>
    );
  }

  // Shared public markets navigate away; group markets can bet inline via onBet
  if (!isShared && market.group_id) {
    return (
      <View style={styles.marketMessageContainer}>
        <FeedTradingPanel
          market={market}
          stats={stats}
          variant="surface"
          onTrade={({ side, optionId }) => onBet(market, optionId, side)}
        />
      </View>
    );
  }

  return (
    <View style={styles.marketMessageContainer}>
      <SocialShareMarketCard
        market={market}
        stats={stats}
        inline
        onPredict={() => {router.push(`/market/${market.id}` as any)}}
        onClose={() => {}}
      />
    </View>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────
interface ChatTabProps {
  messages: Message[];
  messagesLoading: boolean;
  currentUser: { id: string } | null;
  router: Router;
  isAdmin: boolean;
  marketRefreshTrigger: number;
  inputText: string;
  setInputText: (text: string) => void;
  onSendMessage: () => void;
  onAttachPress: () => void;
  isUploadingImage: boolean;
  groupId: string;
  onSendMention: (payload: MentionEmbedPayload) => void | Promise<void>;
  onBet: (market: Market, optionId: string, side: "yes" | "no") => void;
  onResolve: (marketId: string, optionId: string) => void;
  currentUserId?: string;
  embedded?: boolean;
}

// ─── ChatTab ───────────────────────────────────────────────────────────────
export function ChatTab({
  messages,
  messagesLoading,
  currentUser,
  router,
  isAdmin,
  marketRefreshTrigger,
  inputText,
  setInputText,
  onSendMessage,
  onAttachPress,
  isUploadingImage,
  groupId,
  onSendMention,
  onBet,
  onResolve,
  currentUserId,
  embedded = false,
}: ChatTabProps) {
  const { theme, isDark } = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const skipKeyboardAvoiding = embedded || Platform.OS === "web";

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  // ── Message rendering ──────────────────────────────────────────────────
  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.user_id === currentUser?.id;

    const getDisplayName = () => {
      if (isMe) return null;
      if (item.user?.username?.trim()) return item.user.username;
      if (item.user?.email) {
        const parts = item.user.email.split("@");
        if (parts[0]?.trim()) return parts[0];
      }
      if (item.user_id) return item.user_id.substring(0, 8);
      return "User";
    };

    const displayName = getDisplayName();

    const renderStatusIndicator = (forMarket = false) => {
      if (!isMe) return null; // Status indicators are only for my messages
      const status = item.status || "delivered";

      if (forMarket) {
        switch (status) {
          case "sending":
            return <Text style={[styles.marketStatusIndicator, { color: '#8E8E93' }]}>✓</Text>;
          case "sent":
            return <Text style={[styles.marketStatusIndicator, { color: theme.primary }]}>✓</Text>;
          default:
            return <Text style={[styles.marketStatusIndicator, { color: theme.primary }]}>✓✓</Text>;
        }
      }

      switch (status) {
        case "sending":
          return <Text style={styles.statusIndicatorText}>✓</Text>;
        case "sent":
          return <Text style={[styles.statusIndicatorText, { color: theme.primary }]}>✓</Text>;
        default:
          return <Text style={[styles.statusIndicatorText, { color: theme.primary }]}>✓✓</Text>;
      }
    };

    // Market messages
    if ((item.message_type === "market" || item.message_type === "shared_market") && item.market_id) {
      const isOptimistic = item.market_id.startsWith("temp_");
      const isShared = item.message_type === "shared_market";
      
      return (
        <View style={styles.marketWrapper}>
          <View style={styles.marketAnnounceRow}>
            <Text style={styles.marketAnnounce}>
              {isMe ? "You" : displayName || "Someone"} {isShared ? "shared a prediction" : "started a prediction"}
            </Text>
            {isMe && (
              <View style={styles.marketStatusRow}>
                <Text style={styles.marketTime}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
                {renderStatusIndicator(true)}
              </View>
            )}
          </View>
          {isOptimistic ? (
            <View style={styles.optimisticMarketCard}>
              <Text style={styles.optimisticMarketText}>{item.content?.replace("New Market: ", "")}</Text>
              <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 12 }} />
              <Text style={styles.optimisticMarketSubtext}>Creating prediction...</Text>
            </View>
          ) : (
            <MarketMessage
              marketId={item.market_id}
              router={router}
              onBet={onBet}
              onResolve={onResolve}
              isAdmin={isAdmin}
              refreshTrigger={marketRefreshTrigger}
              isShared={isShared}
              currentUserId={currentUserId}
            />
          )}
        </View>
      );
    }

    const navigateToProfile = () => {
      if (item.user_id === currentUser?.id) {
        router.push("/profile");
      } else {
        router.push(`/profile/${item.user_id}`);
      }
    };

    const Avatar = () => (
      <TouchableOpacity 
        onPress={navigateToProfile} 
        activeOpacity={0.8} 
        style={[styles.avatarContainer, isMe ? { marginLeft: 8 } : { marginRight: 8 }, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
      >
        {item.user?.avatar_url ? (
          <Image 
            source={{ uri: item.user.avatar_url }} 
            style={styles.messageAvatar} 
            contentFit="cover" 
            transition={200} 
          />
        ) : (
          <View style={[styles.messageAvatarPlaceholder, { backgroundColor: getRandomColor(displayName || "User") }]}>
            <Text style={styles.messageAvatarInitials}>{displayName?.[0]?.toUpperCase() || "U"}</Text>
          </View>
        )}
      </TouchableOpacity>
    );

    // Mention embed cards
    if (item.message_type === "shared_group" && item.referenced_group_id) {
      return (
        <View style={[styles.messageRow, isMe ? styles.messageRowRight : styles.messageRowLeft]}>
          {!isMe && <Avatar />}
          <MentionMessage variant="group" id={item.referenced_group_id} />
          {isMe && <Avatar />}
        </View>
      );
    }

    if (item.message_type === "shared_profile" && item.referenced_user_id) {
      return (
        <View style={[styles.messageRow, isMe ? styles.messageRowRight : styles.messageRowLeft]}>
          {!isMe && <Avatar />}
          <MentionMessage variant="profile" id={item.referenced_user_id} />
          {isMe && <Avatar />}
        </View>
      );
    }

    if (item.message_type === "shared_bet" && item.bet_id) {
      return (
        <View style={[styles.messageRow, isMe ? styles.messageRowRight : styles.messageRowLeft]}>
          {!isMe && <Avatar />}
          <MentionMessage variant="bet" id={item.bet_id} />
          {isMe && <Avatar />}
        </View>
      );
    }

    // Image messages
    if (item.message_type === "image" && item.content) {
      return (
        <View style={[styles.messageRow, isMe ? styles.messageRowRight : styles.messageRowLeft]}>
          {!isMe && <Avatar />}
          <View
            style={[
              styles.imageBubble,
              isMe 
                ? [styles.myImageBubble, { backgroundColor: theme.primary }] 
                : [styles.theirImageBubble, { backgroundColor: isDark ? "rgba(44, 44, 46, 0.8)" : "rgba(242, 242, 247, 0.9)" }],
              !isMe && { borderColor: theme.border, borderWidth: isDark ? 1 : 0 },
            ]}
          >
            {!isMe && displayName && (
              <TouchableOpacity onPress={navigateToProfile}>
                <Text style={[styles.senderName, { color: getRandomColor(displayName || "User"), marginBottom: 4 }]}>
                  {displayName}
                </Text>
              </TouchableOpacity>
            )}
            <Image source={{ uri: item.content }} style={styles.chatImage} contentFit="cover" transition={200} />
            <View style={styles.messageFooter}>
              <Text style={[styles.messageTime, { color: isMe ? "rgba(255,255,255,0.7)" : theme.textSecondary }]}>
                {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
              {!isMe && (
                <ReportContentButton
                  targetType="group_message"
                  targetId={item.id}
                  targetUserId={item.user_id}
                  label="Report"
                  theme={{
                    text: theme.text,
                    textSecondary: theme.textSecondary,
                    surface: theme.surface,
                    border: theme.border,
                    primary: theme.primary,
                  }}
                />
              )}
              {renderStatusIndicator()}
            </View>
          </View>
          {isMe && <Avatar />}
        </View>
      );
    }

    // Text messages
    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowRight : styles.messageRowLeft]}>
        {!isMe && <Avatar />}
        <View
          style={[
            styles.messageBubble,
            isMe
              ? [styles.myMessage, { 
                  backgroundColor: theme.primary, 
                  borderBottomRightRadius: 4, 
                  borderTopRightRadius: 18,
                  borderTopLeftRadius: 18,
                  borderBottomLeftRadius: 18,
                }]
              : [styles.theirMessage, { 
                  backgroundColor: isDark ? "rgba(44, 44, 46, 0.8)" : "rgba(242, 242, 247, 0.9)", 
                  borderBottomLeftRadius: 4, 
                  borderTopLeftRadius: 18,
                  borderTopRightRadius: 18,
                  borderBottomRightRadius: 18,
                  borderWidth: 1, 
                  borderColor: theme.border 
                }],
          ]}
        >
          {!isMe && displayName && (
            <TouchableOpacity onPress={navigateToProfile}>
              <Text style={[styles.senderName, { color: getRandomColor(displayName || "User") }]}>{displayName}</Text>
            </TouchableOpacity>
          )}
          <View style={styles.messageContent}>
            <Text style={[styles.messageText, { color: isMe ? "#FFFFFF" : theme.text }]}>{item.content}</Text>
            <View style={styles.messageMeta}>
              <Text style={[styles.messageTime, { color: isMe ? "rgba(255,255,255,0.55)" : theme.textSecondary }]}>
                {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
              {!isMe && (
                <ReportContentButton
                  targetType="group_message"
                  targetId={item.id}
                  targetUserId={item.user_id}
                  label="Report"
                  theme={{
                    text: theme.text,
                    textSecondary: theme.textSecondary,
                    surface: theme.surface,
                    border: theme.border,
                    primary: theme.primary,
                  }}
                />
              )}
              {renderStatusIndicator()}
            </View>
          </View>
        </View>
        {isMe && <Avatar />}
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────
  const chatBody = (
    <View style={styles.chatBody}>
      <FlatList
        style={styles.messageListContainer}
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item: Message) => item.id}
        contentContainerStyle={[
          styles.messageList,
          embedded && styles.messageListEmbedded,
          messages.length === 0 && styles.emptyMessageList,
        ]}
        ListEmptyComponent={
          <View style={styles.emptyMessages}>
            <Text style={styles.emptyMessagesText}>No messages yet</Text>
            <Text style={styles.emptyMessagesSubtext}>Start a conversation or create a prediction!</Text>
          </View>
        }
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.1}
      />

      <ChatComposer
        value={inputText}
        onChangeText={setInputText}
        onSend={onSendMessage}
        onAttachPress={onAttachPress}
        isUploadingImage={isUploadingImage}
        mentionContext={{ groupId }}
        onSendMention={onSendMention}
      />
    </View>
  );

  if (skipKeyboardAvoiding) {
    return (
      <View style={[styles.chatArea, { backgroundColor: theme.background, flex: 1, minHeight: 0 }]}>
        {chatBody}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.chatArea, { backgroundColor: theme.background }]}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      {chatBody}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  chatArea: {
    flex: 1,
    minHeight: 0,
  },
  chatBody: {
    flex: 1,
    minHeight: 0,
  },
  messageListContainer: {
    flex: 1,
    minHeight: 0,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  messageListEmbedded: {
    paddingTop: CHAT_LIST_PADDING_TOP,
    paddingHorizontal: CHAT_LIST_PADDING_X,
    paddingBottom: 24,
  },
  emptyMessageList: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyMessages: {
    alignItems: "center",
  },
  emptyMessagesText: {
    fontSize: 17,
    fontWeight: '400',
    color: "#8E8E93",
    marginTop: 12,
  },
  emptyMessagesSubtext: {
    fontSize: 14,
    color: "#C7C7CC",
    marginTop: 4,
    textAlign: "center",
  },
  // Message rows
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 10,
  },
  messageRowLeft: {
    justifyContent: "flex-start",
  },
  messageRowRight: {
    justifyContent: "flex-end",
  },
  myMessage: {
    alignSelf: "flex-end",
  },
  theirMessage: {
    alignSelf: "flex-start",
  },
  senderName: {
    fontSize: 11,
    color: "#8E8E93",
    marginBottom: 2,
    marginLeft: 12,
  },
  avatarContainer: {
    marginBottom: 4,
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  messageAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  messageAvatarInitials: {
    fontSize: 12,
    fontWeight: '400',
    color: "#fff",
  },
  messageBubble: {
    maxWidth: "75%",
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 5,
    borderRadius: 18,
    marginBottom: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  messageContent: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    columnGap: 6,
    rowGap: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginLeft: "auto",
    paddingBottom: 1,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 10,
    lineHeight: 13,
    color: "#8E8E93",
  },
  // Status indicators
  statusIndicatorText: {
    fontSize: 10,
    color: "#8E8E93",
    marginLeft: 4,
  },
  marketStatusIndicator: {
    fontSize: 12,
    marginRight: 6,
  },
  // Market in chat
  marketMessageContainer: {
    marginVertical: 4,
    width: "85%",
    alignSelf: "flex-start",
  },
  marketWrapper: {
    marginBottom: 16,
  },
  marketAnnounceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  marketAnnounce: {
    fontSize: 13,
    fontWeight: '400',
    color: Brand.primary,
  },
  marketStatusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  marketTime: {
    fontSize: 13,
    color: "#8E8E93",
  },
  optimisticMarketCard: {
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    opacity: 0.7,
  },
  optimisticMarketText: {
    fontSize: 15,
    fontWeight: '400',
    marginBottom: 4,
  },
  optimisticMarketSubtext: {
    fontSize: 13,
    color: "#8E8E93",
  },
  errorCard: {
    padding: 16,
    borderRadius: 12,
    marginVertical: 8,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  errorCardText: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
  },
  // Image messages
  imageBubble: {
    padding: 2,
    borderRadius: 12,
    maxWidth: "75%",
    overflow: "hidden",
  },
  myImageBubble: {
    backgroundColor: Brand.primary,
    borderBottomRightRadius: 4,
    borderTopRightRadius: 20,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  theirImageBubble: {
    backgroundColor: "rgba(242, 242, 247, 0.9)",
    borderBottomLeftRadius: 4,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  chatImage: {
    width: 250,
    height: 180,
    borderRadius: 10,
  },
});
