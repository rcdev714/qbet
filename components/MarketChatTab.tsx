import { Image } from "expo-image";
import React, { useEffect, useRef, useState } from "react";
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
  const { theme, isDark } = useTheme();
  const { user } = useAuthContext();
  const { messages, loading, sendMessage } = useMarketChat(marketId);
  const [inputText, setInputText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText("");
    await sendMessage(text);
  };

  // Auto-scroll to bottom on new messages
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
    
    // Display Name Logic
    const displayName = item.user?.username || 
                       item.user?.email?.split('@')[0] || 
                       "User";
                       
    const Avatar = () => (
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
    );

    const isBetNotification = item.content.startsWith('bet $');

    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowRight : styles.messageRowLeft]}>
        {!isMe && <Avatar />}
        <View style={[
          styles.messageBubble,
          isMe
            ? [styles.myMessage, { backgroundColor: "#007AFF", borderBottomRightRadius: 2, borderTopRightRadius: 18 }]
            : [styles.theirMessage, { backgroundColor: isBetNotification ? (isDark ? '#2C2C2E' : '#F2F2F7') : theme.surface, borderBottomLeftRadius: 2, borderTopLeftRadius: 18, borderWidth: 1, borderColor: theme.border }],
          isOptimistic && { opacity: 0.7 },
          isBetNotification && { borderStyle: 'dashed' }
        ]}>
          {!isMe && (
            <Text style={[styles.senderName, { color: getRandomColor(displayName) }]}>
              {displayName}
            </Text>
          )}
          <Text style={[
            styles.messageText, 
            { color: isMe ? "#fff" : theme.text },
            isBetNotification && { fontStyle: 'italic', fontWeight: '500' }
          ]}>
            {isBetNotification && "💸 "}
            {isBetNotification && (
              <Text style={{ fontWeight: '700' }}>@{displayName}: </Text>
            )}
            {item.content}
          </Text>
          <Text style={[styles.messageTime, { color: isMe ? "rgba(255,255,255,0.7)" : theme.textSecondary }]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
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
              No messages yet. Be the first to comment!
            </Text>
          </View>
        }
      />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: isDark ? theme.background : "#F2F2F7", color: theme.text }]}
            placeholder="Say something..."
            placeholderTextColor={theme.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
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
    maxWidth: "85%",
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
    fontWeight: "600",
  },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    minWidth: 60,
  },
  myMessage: {
    // defined in render
  },
  theirMessage: {
    // defined in render
  },
  senderName: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
    marginLeft: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 10,
    alignSelf: "flex-end",
    marginTop: 4,
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
    backgroundColor: "#007AFF",
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
    fontWeight: "bold",
  },
});
