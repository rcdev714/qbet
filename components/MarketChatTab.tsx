import { MentionMessage } from "@/components/chat/MentionMessage";
import { MentionPicker } from "@/components/chat/MentionPicker";
import { ReportContentButton } from "@/components/moderation/ReportContentButton";
import { Brand } from "@/constants/theme";
import { detectMentionQuery, stripMentionTrigger } from "@/lib/mentions";
import type { MentionEmbedPayload } from "@/types/mention";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useAuthContext } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useMarketChat } from "../hooks/useMarketChat";
import { getRandomColor } from "../lib/colors";
import type { MarketChatMessage } from "../types/marketChat";

export function MarketChatTab({ marketId }: { marketId: string }) {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const { user } = useAuthContext();
  const { t } = useTranslation("feed");
  const { messages, loading, sendMessage, sendMentionMessage } = useMarketChat(marketId);
  const [inputText, setInputText] = useState("");
  const [selectionStart, setSelectionStart] = useState<number | undefined>(undefined);
  const flatListRef = useRef<FlatList<MarketChatMessage>>(null);

  const mentionState = useMemo(
    () => detectMentionQuery(inputText, selectionStart),
    [inputText, selectionStart],
  );

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText("");
    await sendMessage(text);
  };

  const handleSendMention = async (payload: MentionEmbedPayload) => {
    if (mentionState) {
      setInputText(stripMentionTrigger(inputText, mentionState.triggerStart));
    }
    await sendMentionMessage(payload);
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const renderMessage = ({ item }: { item: MarketChatMessage }) => {
    const isMe = item.user_id === user?.id;
    const isOptimistic = item.id.startsWith('temp-');
    
    const displayName = item.user?.username || 
                       item.user?.email?.split('@')[0] || 
                       "User";
                       
    const Avatar = () => (
      <TouchableOpacity onPress={() => router.push(`/profile/${item.user_id}`)} disabled={isMe} style={Platform.OS === 'web' ? { cursor: 'pointer' } : {}}>
        <View style={styles.avatarContainer}>
            {item.user?.avatar_url ? (
            <Image
                source={{ uri: item.user.avatar_url }}
                style={styles.avatar}
                contentFit="cover"
                transition={200}
            />
            ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: getRandomColor(displayName) }]}>
                <Text style={styles.avatarInitials}>{displayName[0]?.toUpperCase()}</Text>
            </View>
            )}
        </View>
      </TouchableOpacity>
    );

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

    const isBetNotification = item.message_type === "text" && item.content.startsWith('bet $');

    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowRight : styles.messageRowLeft]}>
        {!isMe && <Avatar />}
        <View style={[
          styles.messageBubble,
          isMe
            ? [styles.myMessage, { backgroundColor: theme.primary, borderBottomRightRadius: 2, borderTopRightRadius: 18 }]
            : [styles.theirMessage, { backgroundColor: isBetNotification ? (isDark ? '#2C2C2E' : '#F2F2F7') : theme.surface, borderBottomLeftRadius: 2, borderTopLeftRadius: 18, borderWidth: 1, borderColor: theme.border }],
          isOptimistic && { opacity: 0.7 },
          isBetNotification && { borderStyle: 'dashed' }
        ]}>
          {!isMe && (
            <TouchableOpacity onPress={() => router.push(`/profile/${item.user_id}`)} style={Platform.OS === 'web' ? { cursor: 'pointer' } : {}}>
                <Text style={[styles.senderName, { color: getRandomColor(displayName) }]}>
                {displayName}
                </Text>
            </TouchableOpacity>
          )}
          <View style={styles.messageContent}>
            <Text style={[
              styles.messageText, 
              { color: isMe ? "#fff" : theme.text },
              isBetNotification && { fontStyle: 'italic', fontWeight: '400' }
            ]}>
              {isBetNotification && "💸 "}
              {isBetNotification && (
                <Text style={{ fontWeight: '400' }}>@{displayName}: </Text>
              )}
              {item.content}
            </Text>
            <View style={styles.messageMeta}>
              <Text style={[styles.messageTime, { color: isMe ? "rgba(255,255,255,0.55)" : theme.textSecondary }]}>
                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              {!isMe && !isBetNotification && !isOptimistic ? (
                <ReportContentButton
                  targetType="market_chat_message"
                  targetId={item.id}
                  targetUserId={item.user_id}
                  label={t("chatReport")}
                  theme={{
                    text: theme.text,
                    textSecondary: theme.textSecondary,
                    surface: theme.surface,
                    border: theme.border,
                    primary: theme.primary,
                  }}
                />
              ) : null}
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.text} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          messages.length === 0 && styles.emptyList
        ]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {t("chatNoMessages")}
            </Text>
          </View>
        }
      />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        {mentionState?.active ? (
          <MentionPicker
            visible
            query={mentionState.query}
            context={{ marketId }}
            onSelect={(payload) => void handleSendMention(payload)}
            onClose={() => undefined}
          />
        ) : null}
        <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: isDark ? theme.background : theme.input, color: theme.text }, Platform.OS === 'web' && { cursor: 'text' } as any]}
            placeholder={t("chatPlaceholder")}
            placeholderTextColor={theme.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            onSelectionChange={(event) => setSelectionStart(event.nativeEvent.selection.start)}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled, Platform.OS === 'web' && { cursor: 'pointer' } as any]}
            onPress={handleSendMessage}
            disabled={!inputText.trim()}
          >
            <Text style={styles.sendButtonText}>➔</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    paddingVertical: 40,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyContainer: {
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 15,
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-end",
    maxWidth: "100%",
  },
  messageRowLeft: {
    alignSelf: "flex-start",
  },
  messageRowRight: {
    alignSelf: "flex-end",
  },
  avatarContainer: {
    marginRight: 8,
    marginBottom: 2,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    color: "#fff",
    fontSize: 14,
    fontWeight: '400',
  },
  messageBubble: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 5,
    borderRadius: 18,
    minWidth: 60,
    maxWidth: "85%",
  },
  myMessage: {},
  theirMessage: {},
  senderName: {
    fontSize: 11,
    fontWeight: '400',
    marginBottom: 2,
    marginLeft: 2,
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
  messageTime: {
    fontSize: 10,
    lineHeight: 13,
  },
  inputContainer: {
    flexDirection: "row",
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 0,
  },
  sendButtonDisabled: {
    backgroundColor: "#B0B0B0",
    opacity: 0.5,
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: '400',
  },
});
